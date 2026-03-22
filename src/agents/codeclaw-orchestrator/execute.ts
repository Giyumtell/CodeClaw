import { mkdir } from "node:fs/promises";
import { readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { moveTask } from "../codeclaw-board/board-ops.js";
import { addMemoryAction, initRoleMemory, writeRoleMemory } from "../codeclaw-memory/memory-io.js";
import { resolveCodeClawSpawn, type CodeClawSpawnConfig } from "../codeclaw-spawn/resolve.js";
import { readOrchestratorState } from "./orchestrator-io.js";
import { advancePhase } from "./orchestrator.js";
import {
  createPersistentSessionsState,
  readPersistentSessions,
  registerPersistentSession,
  resolveSessionAction,
  writePersistentSessions,
} from "./persistent-sessions.js";
import { getNextCodeClawStep, type CodeClawRunStep } from "./runner.js";

export interface CodeClawExecuteResult {
  step: CodeClawRunStep;
  spawn: CodeClawSpawnConfig;
  action: "spawn" | "send";
  spawnParams?: {
    task: string;
    model?: string;
    agentId: string;
    systemPromptAddition: string;
    workspace: string;
    label: string;
    sessionKey?: string;
  };
  sendParams?: {
    key: string;
    message: string;
    label: string;
    agentId: string;
  };
}

function isPersistentCodeClawRole(
  role: CodeClawRunStep["role"],
): role is "team-lead" | "project-manager" | "business-analyst" | "security" {
  return (
    role === "team-lead" ||
    role === "project-manager" ||
    role === "business-analyst" ||
    role === "security"
  );
}

/**
 * Prepare the next step for execution.
 * Returns everything needed to spawn the agent — the caller (gateway handler
 * or CLI) is responsible for the actual spawn call.
 */
export async function prepareNextExecution(params: {
  repoRoot: string;
  agentBaseDir?: string;
}): Promise<CodeClawExecuteResult | null> {
  const step = await getNextCodeClawStep(params);
  if (!step) {
    return null;
  }

  const board = await readBoard(params.repoRoot);
  if (!board) {
    return null;
  }

  const sessionsState =
    (await readPersistentSessions(params.repoRoot)) ??
    createPersistentSessionsState(board.projectName, params.repoRoot);
  const sessionAction = resolveSessionAction(sessionsState, step.role);

  const spawn = await resolveCodeClawSpawn({
    role: step.role,
    repoRoot: params.repoRoot,
    taskTitle: step.taskTitle,
    taskId: step.taskId,
    objective: step.directive,
    acceptanceCriteria: [],
    constraints: [],
    agentBaseDir: params.agentBaseDir,
  });

  moveTask(board, step.taskId, "in-progress");
  await writeBoard(board);

  await (async () => {
    await mkdir(spawn.agentDir, { recursive: true });
    const memory = await initRoleMemory(spawn.agentDir, step.role);
    if (!memory.activeTaskIds.includes(step.taskId)) {
      memory.activeTaskIds.push(step.taskId);
    }
    memory.currentFocus = `Task #${step.taskId}: ${step.taskTitle}`;
    addMemoryAction(memory, {
      action: `Starting task #${step.taskId}: ${step.taskTitle}`,
      taskId: step.taskId,
      details: "Marked in-progress by execution engine",
    });
    await writeRoleMemory(spawn.agentDir, memory);
  })().catch(() => {});

  if (sessionAction.action === "send") {
    return {
      step,
      spawn,
      action: "send",
      sendParams: {
        key: sessionAction.sessionKey,
        message: spawn.taskDirective,
        label: `codeclaw-${step.role}-task-${step.taskId}`,
        agentId: spawn.agentId,
      },
    };
  }

  const defaultSessionKey = isPersistentCodeClawRole(step.role)
    ? `codeclaw-${step.role}`
    : undefined;

  if (defaultSessionKey && isPersistentCodeClawRole(step.role)) {
    registerPersistentSession(sessionsState, step.role, {
      sessionKey: defaultSessionKey,
      label: `codeclaw-${step.role}-task-${step.taskId}`,
      agentId: spawn.agentId,
      spawnedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      active: true,
    });
    await writePersistentSessions(params.repoRoot, sessionsState);
  }

  return {
    step,
    spawn,
    action: "spawn",
    spawnParams: {
      task: spawn.taskDirective,
      model: spawn.model,
      agentId: spawn.agentId,
      systemPromptAddition: spawn.systemPromptAddition,
      workspace: params.repoRoot,
      label: `codeclaw-${step.role}-task-${step.taskId}`,
      sessionKey: defaultSessionKey,
    },
  };
}

/**
 * Mark a step as completed and advance the orchestrator.
 */
export async function completeExecution(params: {
  repoRoot: string;
  taskId: number;
  success: boolean;
  notes?: string;
}): Promise<void> {
  const board = await readBoard(params.repoRoot);
  if (board) {
    moveTask(board, params.taskId, params.success ? "done" : "blocked");
    await writeBoard(board);
  }

  const state = await readOrchestratorState(params.repoRoot);
  if (state) {
    await advancePhase(state);
  }
}
