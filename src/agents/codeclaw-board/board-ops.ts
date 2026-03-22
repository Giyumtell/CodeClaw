import type { CodeClawRole } from "../codeclaw-roles/types.js";
import type { CodeClawBoard, CodeClawBoardTask, CodeClawTaskStatus } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function getExistingTask(board: CodeClawBoard, taskId: number): CodeClawBoardTask {
  const task = board.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error(`Task #${taskId} not found`);
  }
  return task;
}

export function createTask(
  board: CodeClawBoard,
  params: {
    title: string;
    assignedRole?: CodeClawRole;
    acceptanceCriteria?: string[];
    constraints?: string[];
    notes?: string;
  },
): CodeClawBoardTask {
  const timestamp = nowIso();
  const task: CodeClawBoardTask = {
    id: board.nextTaskId,
    title: params.title,
    status: "backlog",
    assignedRole: params.assignedRole,
    acceptanceCriteria: params.acceptanceCriteria ?? [],
    constraints: params.constraints ?? [],
    blockers: [],
    notes: params.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  board.tasks.push(task);
  board.nextTaskId += 1;

  return task;
}

export function moveTask(
  board: CodeClawBoard,
  taskId: number,
  newStatus: CodeClawTaskStatus,
): void {
  const task = getExistingTask(board, taskId);
  task.status = newStatus;
  task.updatedAt = nowIso();
}

export function assignTask(
  board: CodeClawBoard,
  taskId: number,
  role: CodeClawRole,
  agentId?: string,
): void {
  const task = getExistingTask(board, taskId);
  task.assignedRole = role;
  if (agentId !== undefined) {
    task.agentId = agentId;
  }
  task.updatedAt = nowIso();
}

export function addBlocker(board: CodeClawBoard, taskId: number, blocker: string): void {
  const task = getExistingTask(board, taskId);
  task.blockers.push(blocker);
  task.status = "blocked";
  task.updatedAt = nowIso();
}

export function removeBlocker(board: CodeClawBoard, taskId: number, blockerIndex: number): void {
  const task = getExistingTask(board, taskId);
  if (blockerIndex < 0 || blockerIndex >= task.blockers.length) {
    throw new Error(`Invalid blocker index ${blockerIndex} for task #${taskId}`);
  }

  task.blockers.splice(blockerIndex, 1);
  if (task.blockers.length === 0) {
    task.status = "backlog";
  }
  task.updatedAt = nowIso();
}

export function getTasksByStatus(
  board: CodeClawBoard,
  status: CodeClawTaskStatus,
): CodeClawBoardTask[] {
  return board.tasks.filter((task) => task.status === status);
}

export function getTaskById(board: CodeClawBoard, taskId: number): CodeClawBoardTask | undefined {
  return board.tasks.find((task) => task.id === taskId);
}
