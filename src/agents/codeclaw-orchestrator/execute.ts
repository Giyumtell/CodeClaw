import { mkdir } from "node:fs/promises";
import { readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { moveTask } from "../codeclaw-board/board-ops.js";
import { addMemoryAction, initRoleMemory, writeRoleMemory } from "../codeclaw-memory/memory-io.js";
import { resolveCodeClawSpawn, type CodeClawSpawnConfig } from "../codeclaw-spawn/resolve.js";
import { readOrchestratorState } from "./orchestrator-io.js";
import { advancePhase } from "./orchestrator.js";
import { getNextCodeClawStep, type CodeClawRunStep } from "./runner.js";

export interface CodeClawExecuteResult {
  step: CodeClawRunStep;
  spawn: CodeClawSpawnConfig;
  spawnParams: {
    task: string;
    model?: string;
    agentId: string;
    systemPromptAddition: string;
    workspace: string;
    label: string;
  };
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

  return {
    step,
    spawn,
    spawnParams: {
      task: spawn.taskDirective,
      model: spawn.model,
      agentId: spawn.agentId,
      systemPromptAddition: spawn.systemPromptAddition,
      workspace: params.repoRoot,
      label: `codeclaw-${step.role}-task-${step.taskId}`,
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
