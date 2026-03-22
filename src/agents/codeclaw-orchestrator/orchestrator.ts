import { initBoard, readBoard } from "../codeclaw-board/index.js";
import type { CodeClawBoardTask } from "../codeclaw-board/types.js";
import type { CodeClawRole } from "../codeclaw-roles/index.js";
import { readOrchestratorState, writeOrchestratorState } from "./orchestrator-io.js";
import type { OrchestratorPhase, OrchestratorState } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function completeCurrentPhase(state: OrchestratorState, completedAt: string): void {
  const current = state.phaseHistory[state.phaseHistory.length - 1];
  if (current && !current.completedAt) {
    current.completedAt = completedAt;
  }
}

function startNextPhase(
  state: OrchestratorState,
  phase: OrchestratorPhase,
  startedAt: string,
): void {
  state.currentPhase = phase;
  state.phaseHistory.push({ phase, startedAt });
}

function isRoleTask(task: CodeClawBoardTask, role: CodeClawRole): boolean {
  return task.assignedRole === role;
}

function everyTaskHasStatus(
  tasks: CodeClawBoardTask[],
  status: CodeClawBoardTask["status"],
): boolean {
  return tasks.length > 0 && tasks.every((task) => task.status === status);
}

function everyTaskInStatusSet(
  tasks: CodeClawBoardTask[],
  allowedStatuses: Set<CodeClawBoardTask["status"]>,
): boolean {
  return tasks.length > 0 && tasks.every((task) => allowedStatuses.has(task.status));
}

function determineNextPhase(
  state: OrchestratorState,
  tasks: CodeClawBoardTask[],
): OrchestratorPhase {
  if (tasks.length === 0) {
    return state.currentPhase;
  }

  const baTasks = tasks.filter((task) => isRoleTask(task, "business-analyst"));
  const devTasks = tasks.filter((task) => isRoleTask(task, "developer"));
  const testerTasks = tasks.filter((task) => isRoleTask(task, "tester"));
  const reviewerTasks = tasks.filter((task) => isRoleTask(task, "reviewer"));
  const allDone = tasks.every((task) => task.status === "done");

  if (allDone && state.currentPhase !== "requirements") {
    return "done";
  }

  if (state.currentPhase === "requirements" && everyTaskHasStatus(baTasks, "done")) {
    return "planning";
  }

  if (
    (state.currentPhase === "planning" || state.currentPhase === "rework") &&
    everyTaskInStatusSet(devTasks, new Set(["in-progress", "in-review", "done"]))
  ) {
    return "development";
  }

  if (
    state.currentPhase === "development" &&
    everyTaskInStatusSet(devTasks, new Set(["in-review", "done"]))
  ) {
    return "testing";
  }

  if (
    state.currentPhase === "testing" &&
    everyTaskInStatusSet(testerTasks, new Set(["in-review", "done"]))
  ) {
    return "review";
  }

  if (state.currentPhase === "review") {
    if (reviewerTasks.some((task) => task.status === "in-progress")) {
      return "rework";
    }
    if (everyTaskInStatusSet(reviewerTasks, new Set(["done"]))) {
      return "done";
    }
  }

  return state.currentPhase;
}

function formatAcceptanceCriteria(acceptanceCriteria: string[]): string {
  if (acceptanceCriteria.length === 0) {
    return "- No explicit acceptance criteria provided.";
  }

  return acceptanceCriteria.map((item) => `- ${item}`).join("\n");
}

export async function initOrchestrator(params: {
  repoRoot: string;
  projectName: string;
  userGoal: string;
}): Promise<OrchestratorState> {
  const existing = await readOrchestratorState(params.repoRoot);
  if (existing) {
    return existing;
  }

  const board = await readBoard(params.repoRoot);
  if (!board) {
    await initBoard(params.repoRoot, params.projectName);
  }

  const startedAt = nowIso();
  const state: OrchestratorState = {
    projectName: params.projectName,
    repoRoot: params.repoRoot,
    currentPhase: "requirements",
    userGoal: params.userGoal.trim(),
    phaseHistory: [{ phase: "requirements", startedAt }],
  };

  await writeOrchestratorState(state);
  return state;
}

export async function advancePhase(state: OrchestratorState): Promise<OrchestratorPhase> {
  const board = await readBoard(state.repoRoot);
  const tasks = board?.tasks ?? [];
  const nextPhase = determineNextPhase(state, tasks);

  if (nextPhase !== state.currentPhase) {
    const changedAt = nowIso();
    completeCurrentPhase(state, changedAt);
    startNextPhase(state, nextPhase, changedAt);
    await writeOrchestratorState(state);
  }

  return state.currentPhase;
}

export function buildTeamLeadBrief(state: OrchestratorState, boardSummary: string): string {
  return [
    "# Team Lead Brief",
    "",
    `Project: ${state.projectName}`,
    `Repo Root: ${state.repoRoot}`,
    `Current Phase: ${state.currentPhase}`,
    "",
    "User Goal:",
    state.userGoal,
    "",
    "Repository Context Summary:",
    boardSummary.trim() || "No board summary available yet.",
    "",
    "Instructions:",
    "- You are the user-facing owner for this project.",
    "- Define architecture direction and decompose work into executable tasks.",
    "- Delegate execution management to the PM and keep reviewer independence intact.",
  ].join("\n");
}

export function buildPMDirective(state: OrchestratorState, taskBreakdown: string): string {
  return [
    "# PM Directive",
    "",
    `From: Team Lead`,
    `Project: ${state.projectName}`,
    `Current Phase: ${state.currentPhase}`,
    "",
    "Task Breakdown:",
    taskBreakdown.trim() || "No task breakdown provided.",
    "",
    "Operational Expectations:",
    "- Refine requirements with the BA before development begins.",
    "- Keep the board status current and escalate blockers to the Team Lead quickly.",
    "- Manage handoffs: developer -> tester -> reviewer.",
  ].join("\n");
}

export function buildRoleDirective(params: {
  role: CodeClawRole;
  taskTitle: string;
  taskId: number;
  acceptanceCriteria: string[];
  contextSlice?: string;
  boardState?: string;
}): string {
  return [
    "# Role Directive",
    "",
    `Role: ${params.role}`,
    `Task ID: #${params.taskId}`,
    `Task Title: ${params.taskTitle.trim()}`,
    "",
    "Acceptance Criteria:",
    formatAcceptanceCriteria(params.acceptanceCriteria),
    "",
    "Context Slice:",
    params.contextSlice?.trim() || "No scoped context provided.",
    "",
    "Board State:",
    params.boardState?.trim() || "No board state summary provided.",
  ].join("\n");
}
