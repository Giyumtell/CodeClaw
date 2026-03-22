import { readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { addBlocker, getTaskById } from "../codeclaw-board/board-ops.js";
import type { CodeClawRole } from "../codeclaw-roles/types.js";
import { CODECLAW_ROLES } from "../codeclaw-roles/types.js";
import { readOrchestratorState } from "./orchestrator-io.js";
import type { OrchestratorPhase } from "./types.js";

export const STALL_THRESHOLD_MS = 10 * 60 * 1000;

export interface CodeClawLabelParts {
  role: CodeClawRole;
  taskId: number;
}

export interface CodeClawProgressAgent {
  role: CodeClawRole;
  taskId: number;
  label: string;
  title: string;
  updatedAt: string;
  stalled: boolean;
}

export interface CodeClawProgressReport {
  phase: OrchestratorPhase;
  agents: CodeClawProgressAgent[];
  completedTasks: number;
  totalTasks: number;
  stalledAgents: string[];
  boardSummary: {
    backlog: number;
    inProgress: number;
    inReview: number;
    done: number;
    blocked: number;
  };
}

function parseIsoMs(value: string): number | null {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return timestamp;
}

function makeCodeClawLabel(role: CodeClawRole, taskId: number): string {
  return `codeclaw-${role}-task-${taskId}`;
}

export function parseCodeClawLabel(label: string): CodeClawLabelParts | null {
  const parsed = /^codeclaw-(.+)-task-(\d+)$/.exec(label.trim());
  if (!parsed) {
    return null;
  }

  const role = parsed[1];
  const taskId = Number.parseInt(parsed[2], 10);
  if (!(role in CODECLAW_ROLES) || !Number.isInteger(taskId) || taskId <= 0) {
    return null;
  }

  return {
    role: role as CodeClawRole,
    taskId,
  };
}

export async function buildProgressReport(params: {
  repoRoot: string;
}): Promise<CodeClawProgressReport | null> {
  const [board, orchestrator] = await Promise.all([
    readBoard(params.repoRoot),
    readOrchestratorState(params.repoRoot),
  ]);

  if (!board || !orchestrator) {
    return null;
  }

  const now = Date.now();
  const agents: CodeClawProgressAgent[] = board.tasks
    .filter((task) => task.status === "in-progress" && task.assignedRole)
    .map((task) => {
      const updatedAtMs = parseIsoMs(task.updatedAt);
      const stalled = updatedAtMs !== null && now - updatedAtMs > STALL_THRESHOLD_MS;
      return {
        role: task.assignedRole!,
        taskId: task.id,
        label: makeCodeClawLabel(task.assignedRole!, task.id),
        title: task.title,
        updatedAt: task.updatedAt,
        stalled,
      };
    });

  return {
    phase: orchestrator.currentPhase,
    agents,
    completedTasks: board.tasks.filter((task) => task.status === "done").length,
    totalTasks: board.tasks.length,
    stalledAgents: agents.filter((agent) => agent.stalled).map((agent) => agent.label),
    boardSummary: {
      backlog: board.tasks.filter((task) => task.status === "backlog").length,
      inProgress: board.tasks.filter((task) => task.status === "in-progress").length,
      inReview: board.tasks.filter((task) => task.status === "in-review").length,
      done: board.tasks.filter((task) => task.status === "done").length,
      blocked: board.tasks.filter((task) => task.status === "blocked").length,
    },
  };
}

export async function handleStalledAgents(params: {
  repoRoot: string;
  stalledLabels: string[];
}): Promise<number> {
  if (params.stalledLabels.length === 0) {
    return 0;
  }

  const board = await readBoard(params.repoRoot);
  if (!board) {
    return 0;
  }

  let updatedCount = 0;

  for (const label of params.stalledLabels) {
    const parsed = parseCodeClawLabel(label);
    if (!parsed) {
      continue;
    }

    const task = getTaskById(board, parsed.taskId);
    if (!task || task.status !== "in-progress") {
      continue;
    }

    const blocker = `Stalled agent heartbeat overdue (${label})`;
    if (!task.blockers.includes(blocker)) {
      addBlocker(board, parsed.taskId, blocker);
      updatedCount += 1;
    }
  }

  if (updatedCount > 0) {
    await writeBoard(board);
  }

  return updatedCount;
}
