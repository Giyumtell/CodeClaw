import os from "node:os";
import path from "node:path";
import { getDefaultCodeClawAgentConfigs } from "../../agents/codeclaw-agents/types.js";
import { readBoard, writeBoard } from "../../agents/codeclaw-board/board-io.js";
import { moveTask } from "../../agents/codeclaw-board/board-ops.js";
import type { CodeClawTaskStatus } from "../../agents/codeclaw-board/types.js";
import { readRoleMemory } from "../../agents/codeclaw-memory/memory-io.js";
import type { RoleMemoryState } from "../../agents/codeclaw-memory/types.js";
import { initCodeClawProject } from "../../agents/codeclaw-orchestrator/init.js";
import { readOrchestratorState } from "../../agents/codeclaw-orchestrator/orchestrator-io.js";
import { getNextCodeClawStep, planCodeClawRun } from "../../agents/codeclaw-orchestrator/runner.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const VALID_TASK_STATUSES = new Set<CodeClawTaskStatus>([
  "backlog",
  "in-progress",
  "in-review",
  "done",
  "blocked",
]);

function resolveProjectName(repoRoot: string, projectName?: string): string {
  const trimmed = projectName?.trim();
  if (trimmed) {
    return trimmed;
  }
  return path.basename(path.resolve(repoRoot));
}

export const codeclawHandlers: GatewayRequestHandlers = {
  "codeclaw.init": async ({ params, respond }) => {
    const repoRoot = typeof params.repoRoot === "string" ? params.repoRoot.trim() : "";
    const projectName = typeof params.projectName === "string" ? params.projectName : undefined;
    if (!repoRoot) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "repoRoot required"));
      return;
    }

    const result = await initCodeClawProject({
      repoRoot,
      projectName: resolveProjectName(repoRoot, projectName),
    });
    respond(true, result, undefined);
  },
  "codeclaw.board": async ({ params, respond }) => {
    const repoRoot = typeof params.repoRoot === "string" ? params.repoRoot.trim() : "";
    if (!repoRoot) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "repoRoot required"));
      return;
    }

    const board = await readBoard(repoRoot);
    if (!board) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Board not initialized"));
      return;
    }
    respond(true, board, undefined);
  },
  "codeclaw.status": async ({ params, respond }) => {
    const repoRoot = typeof params.repoRoot === "string" ? params.repoRoot.trim() : "";
    if (!repoRoot) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "repoRoot required"));
      return;
    }

    const board = await readBoard(repoRoot);
    if (!board) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Board not initialized"));
      return;
    }

    const orchestratorState = await readOrchestratorState(repoRoot);
    const roleMemories: Record<string, RoleMemoryState> = {};
    const defaultAgentBaseDir = path.join(os.homedir(), ".codeclaw", "agents");
    for (const config of getDefaultCodeClawAgentConfigs(defaultAgentBaseDir)) {
      const memory = await readRoleMemory(config.agentDir, config.role);
      if (memory) {
        roleMemories[config.role] = memory;
      }
    }

    respond(
      true,
      {
        orchestratorState,
        board,
        roleMemories,
      },
      undefined,
    );
  },
  "codeclaw.plan": async ({ params, respond }) => {
    const repoRoot = typeof params.repoRoot === "string" ? params.repoRoot.trim() : "";
    const projectName = typeof params.projectName === "string" ? params.projectName : undefined;
    const userGoal = typeof params.userGoal === "string" ? params.userGoal.trim() : "";
    if (!repoRoot) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "repoRoot required"));
      return;
    }
    if (!userGoal) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "userGoal required"));
      return;
    }

    const steps = await planCodeClawRun({
      repoRoot,
      projectName: resolveProjectName(repoRoot, projectName),
      userGoal,
    });
    respond(true, steps, undefined);
  },
  "codeclaw.next": async ({ params, respond }) => {
    const repoRoot = typeof params.repoRoot === "string" ? params.repoRoot.trim() : "";
    if (!repoRoot) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "repoRoot required"));
      return;
    }

    const nextStep = await getNextCodeClawStep({ repoRoot });
    respond(true, nextStep ?? { done: true }, undefined);
  },
  "codeclaw.advance": async ({ params, respond }) => {
    const repoRoot = typeof params.repoRoot === "string" ? params.repoRoot.trim() : "";
    const taskId = typeof params.taskId === "number" ? params.taskId : Number.NaN;
    const newStatus = typeof params.newStatus === "string" ? params.newStatus : "";
    if (!repoRoot) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "repoRoot required"));
      return;
    }
    if (!Number.isInteger(taskId) || taskId <= 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "taskId must be a positive integer"),
      );
      return;
    }
    if (!VALID_TASK_STATUSES.has(newStatus as CodeClawTaskStatus)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid task status"));
      return;
    }

    const board = await readBoard(repoRoot);
    if (!board) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Board not initialized"));
      return;
    }

    moveTask(board, taskId, newStatus as CodeClawTaskStatus);
    await writeBoard(board);
    respond(true, board, undefined);
  },
};
