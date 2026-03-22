import { formatBoardMarkdown } from "../codeclaw-board/board-format.js";
import { initBoard, readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { createTask } from "../codeclaw-board/board-ops.js";
import type { CodeClawBoardTask } from "../codeclaw-board/types.js";
import type { CodeClawRole } from "../codeclaw-roles/types.js";
import { resolveCodeClawSpawn } from "../codeclaw-spawn/resolve.js";
import { readOrchestratorState } from "./orchestrator-io.js";
import { initOrchestrator, advancePhase } from "./orchestrator.js";
import { buildSecurityScanDirective } from "./security-scan.js";

export interface CodeClawRunStep {
  phase: string;
  role: CodeClawRole;
  agentId: string;
  taskId: number;
  taskTitle: string;
  directive: string;
}

type PhaseTaskDefinition = {
  phase: string;
  role: CodeClawRole;
  title: string;
};

const LIFECYCLE_TASKS: PhaseTaskDefinition[] = [
  {
    phase: "requirements",
    role: "business-analyst",
    title: "Gather requirements and write acceptance criteria for",
  },
  {
    phase: "planning",
    role: "team-lead",
    title: "Decompose into implementation tasks",
  },
  {
    phase: "development",
    role: "developer",
    title: "Implement",
  },
  {
    phase: "testing",
    role: "tester",
    title: "Test and validate",
  },
  {
    phase: "review",
    role: "reviewer",
    title: "Code review",
  },
  {
    phase: "security",
    role: "security",
    title: "Scan commit diff and flag security risks",
  },
  {
    phase: "tracking",
    role: "project-manager",
    title: "Track progress and report status",
  },
];

function isActionableStatus(status: CodeClawBoardTask["status"]): boolean {
  return status === "backlog" || status === "in-progress";
}

function pickTaskForPhase(params: {
  phase: string;
  tasks: CodeClawBoardTask[];
}): CodeClawBoardTask | null {
  const sortedTasks = params.tasks.toSorted((a, b) => a.id - b.id);

  if (params.phase === "requirements") {
    return (
      sortedTasks.find(
        (task) => task.assignedRole === "business-analyst" && isActionableStatus(task.status),
      ) ?? null
    );
  }

  if (params.phase === "planning") {
    return (
      sortedTasks.find(
        (task) => task.assignedRole === "team-lead" && isActionableStatus(task.status),
      ) ?? null
    );
  }

  if (params.phase === "development") {
    return (
      sortedTasks.find(
        (task) => task.assignedRole === "developer" && isActionableStatus(task.status),
      ) ?? null
    );
  }

  if (params.phase === "testing") {
    return sortedTasks.find((task) => task.assignedRole === "tester") ?? null;
  }

  if (params.phase === "review") {
    return sortedTasks.find((task) => task.assignedRole === "reviewer") ?? null;
  }

  if (params.phase === "security") {
    return sortedTasks.find((task) => task.assignedRole === "security") ?? null;
  }

  if (params.phase === "tracking") {
    return sortedTasks.find((task) => task.assignedRole === "project-manager") ?? null;
  }

  if (params.phase === "rework") {
    return (
      sortedTasks.find(
        (task) =>
          task.assignedRole === "developer" &&
          (task.status === "blocked" || task.status === "backlog" || task.status === "in-progress"),
      ) ?? null
    );
  }

  return null;
}

export async function planCodeClawRun(params: {
  repoRoot: string;
  projectName: string;
  userGoal: string;
  agentBaseDir?: string;
}): Promise<CodeClawRunStep[]> {
  const state = await initOrchestrator({
    repoRoot: params.repoRoot,
    projectName: params.projectName,
    userGoal: params.userGoal,
  });

  let board = await readBoard(params.repoRoot);
  if (!board) {
    board = await initBoard(params.repoRoot, params.projectName);
  }

  const steps: CodeClawRunStep[] = [];
  for (const taskDef of LIFECYCLE_TASKS) {
    const task = createTask(board, {
      title: `${taskDef.title}: ${params.userGoal}`,
      assignedRole: taskDef.role,
      acceptanceCriteria: [],
      constraints: [],
    });

    const spawn = await resolveCodeClawSpawn({
      role: taskDef.role,
      repoRoot: params.repoRoot,
      taskTitle: task.title,
      taskId: task.id,
      objective: params.userGoal,
      acceptanceCriteria: task.acceptanceCriteria,
      constraints: task.constraints,
      agentBaseDir: params.agentBaseDir,
      boardSummary: formatBoardMarkdown(board),
    });

    task.agentId = spawn.agentId;

    steps.push({
      phase: taskDef.phase,
      role: taskDef.role,
      agentId: spawn.agentId,
      taskId: task.id,
      taskTitle: task.title,
      directive:
        taskDef.role === "security"
          ? buildSecurityScanDirective({
              repoRoot: params.repoRoot,
              commitHash: "HEAD",
              diffSummary: `Scan recent changes related to task #${task.id}: ${task.title}`,
              changedFiles: [],
            })
          : spawn.taskDirective,
    });
  }

  await writeBoard(board);
  await advancePhase(state);

  return steps;
}

export async function getNextCodeClawStep(params: {
  repoRoot: string;
  agentBaseDir?: string;
}): Promise<CodeClawRunStep | null> {
  const state = await readOrchestratorState(params.repoRoot);
  if (!state) {
    return null;
  }

  const board = await readBoard(params.repoRoot);
  if (!board) {
    return null;
  }

  const phase = await advancePhase(state);
  if (phase === "done") {
    return null;
  }

  const task = pickTaskForPhase({ phase, tasks: board.tasks });
  if (!task?.assignedRole) {
    return null;
  }

  const spawn = await resolveCodeClawSpawn({
    role: task.assignedRole,
    repoRoot: params.repoRoot,
    taskTitle: task.title,
    taskId: task.id,
    objective: state.userGoal,
    acceptanceCriteria: task.acceptanceCriteria,
    constraints: task.constraints,
    agentBaseDir: params.agentBaseDir,
    boardSummary: formatBoardMarkdown(board),
  });

  return {
    phase,
    role: task.assignedRole,
    agentId: spawn.agentId,
    taskId: task.id,
    taskTitle: task.title,
    directive:
      task.assignedRole === "security"
        ? buildSecurityScanDirective({
            repoRoot: params.repoRoot,
            commitHash: "HEAD",
            diffSummary: `Scan recent changes related to task #${task.id}: ${task.title}`,
            changedFiles: [],
          })
        : spawn.taskDirective,
  };
}
