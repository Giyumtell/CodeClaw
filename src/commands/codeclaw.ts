import fs from "node:fs/promises";
import path from "node:path";
import { formatBoardMarkdown } from "../agents/codeclaw-board/board-format.js";
import { readBoard } from "../agents/codeclaw-board/board-io.js";
import { completeExecution, prepareNextExecution } from "../agents/codeclaw-orchestrator/execute.js";
import { initCodeClawProject } from "../agents/codeclaw-orchestrator/init.js";
import { getNextCodeClawStep, planCodeClawRun } from "../agents/codeclaw-orchestrator/runner.js";
import { resolveStateDir } from "../config/paths.js";
import type { RuntimeEnv } from "../runtime.js";

export type CodeClawProjectTask = {
  id: string;
  title?: string;
  objective: string;
  acceptanceCriteria: string[];
  constraints: string[];
  status: "active" | "done" | "blocked";
  createdAt: string;
  updatedAt: string;
};

export type CodeClawProjectRecord = {
  id: string;
  repoRoot: string;
  workspaceName?: string;
  createdAt: string;
  updatedAt: string;
  activeTaskId?: string;
  tasks: CodeClawProjectTask[];
};

export type CodeClawState = {
  version: 1;
  projects: CodeClawProjectRecord[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function resolveCodeClawStateFile(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "codeclaw", "projects.json");
}

async function loadCodeClawState(stateFile = resolveCodeClawStateFile()): Promise<CodeClawState> {
  try {
    const raw = await fs.readFile(stateFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<CodeClawState>;
    return {
      version: 1,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { version: 1, projects: [] };
    }
    throw error;
  }
}

async function saveCodeClawState(
  state: CodeClawState,
  stateFile = resolveCodeClawStateFile(),
): Promise<void> {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function assignCodeClawTask(params: {
  repoRoot: string;
  objective: string;
  title?: string;
  workspaceName?: string;
  acceptanceCriteria?: string[];
  constraints?: string[];
  stateFile?: string;
}): Promise<{ project: CodeClawProjectRecord; task: CodeClawProjectTask }> {
  const state = await loadCodeClawState(params.stateFile);
  const now = nowIso();
  let project = state.projects.find(
    (entry) => path.resolve(entry.repoRoot) === path.resolve(params.repoRoot),
  );
  if (!project) {
    project = {
      id: slugify(path.basename(params.repoRoot)) || "project",
      repoRoot: params.repoRoot,
      workspaceName: params.workspaceName?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      tasks: [],
    };
    state.projects.push(project);
  }

  const nextIndex = project.tasks.length + 1;
  const task: CodeClawProjectTask = {
    id: `task-${nextIndex}`,
    title: params.title?.trim() || undefined,
    objective: params.objective.trim(),
    acceptanceCriteria: (params.acceptanceCriteria ?? [])
      .map((value) => value.trim())
      .filter(Boolean),
    constraints: (params.constraints ?? []).map((value) => value.trim()).filter(Boolean),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  project.tasks.push(task);
  project.activeTaskId = task.id;
  project.updatedAt = now;
  if (!project.workspaceName && params.workspaceName?.trim()) {
    project.workspaceName = params.workspaceName.trim();
  }

  await saveCodeClawState(state, params.stateFile);
  return { project, task };
}

export async function getCodeClawStatus(params?: { repoRoot?: string; stateFile?: string }) {
  const state = await loadCodeClawState(params?.stateFile);
  const projects = params?.repoRoot
    ? state.projects.filter(
        (entry) => path.resolve(entry.repoRoot) === path.resolve(params.repoRoot!),
      )
    : state.projects;
  return {
    version: state.version,
    projects,
  };
}

export async function codeClawAssignCommand(
  opts: {
    repoRoot?: string;
    objective?: string;
    title?: string;
    workspaceName?: string;
    acceptanceCriteria?: string[];
    constraints?: string[];
    json?: boolean;
    stateFile?: string;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  if (!opts.repoRoot?.trim()) {
    throw new Error("repoRoot required");
  }
  if (!opts.objective?.trim()) {
    throw new Error("objective required");
  }

  const result = await assignCodeClawTask({
    repoRoot: opts.repoRoot,
    objective: opts.objective,
    title: opts.title,
    workspaceName: opts.workspaceName,
    acceptanceCriteria: opts.acceptanceCriteria,
    constraints: opts.constraints,
    stateFile: opts.stateFile,
  });

  if (opts.json) {
    runtime.log(JSON.stringify(result, null, 2));
    return;
  }

  runtime.log(`Assigned ${result.task.id} in ${result.project.id}`);
  runtime.log(`Repo: ${result.project.repoRoot}`);
  runtime.log(`Objective: ${result.task.objective}`);
  if (result.task.acceptanceCriteria.length > 0) {
    runtime.log("Acceptance Criteria:");
    for (const item of result.task.acceptanceCriteria) {
      runtime.log(`- ${item}`);
    }
  }
}

export async function codeClawStatusCommand(
  opts: {
    repoRoot?: string;
    json?: boolean;
    stateFile?: string;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const status = await getCodeClawStatus({
    repoRoot: opts.repoRoot,
    stateFile: opts.stateFile,
  });

  if (opts.json) {
    runtime.log(JSON.stringify(status, null, 2));
    return;
  }

  if (status.projects.length === 0) {
    runtime.log("No CodeClaw projects tracked yet.");
    return;
  }

  for (const project of status.projects) {
    runtime.log(`${project.id} — ${project.repoRoot}`);
    runtime.log(`  tasks: ${project.tasks.length}`);
    runtime.log(`  active: ${project.activeTaskId ?? "none"}`);
    const activeTask = project.tasks.find((task) => task.id === project.activeTaskId);
    if (activeTask) {
      runtime.log(`  objective: ${activeTask.objective}`);
    }
  }
}

export async function codeClawInitCommand(
  opts: {
    repoRoot?: string;
    projectName?: string;
    agentBaseDir?: string;
    json?: boolean;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const repoRoot = path.resolve(opts.repoRoot?.trim() || process.cwd());
  const projectName = opts.projectName?.trim() || path.basename(repoRoot);

  const artifacts = await initCodeClawProject({
    repoRoot,
    projectName,
    agentBaseDir: opts.agentBaseDir,
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          repoRoot,
          projectName,
          ...artifacts,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(`Initialized CodeClaw project in ${repoRoot}`);
  runtime.log(`Board: ${artifacts.boardPath}`);
  runtime.log(`Orchestrator state: ${artifacts.orchestratorPath}`);
  runtime.log("Agent directories:");
  for (const agentDir of artifacts.agentDirs) {
    runtime.log(`- ${agentDir}`);
  }
}

export async function codeClawRunCommand(
  opts: {
    repoRoot?: string;
    userGoal?: string;
    projectName?: string;
    agentBaseDir?: string;
    json?: boolean;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const repoRoot = path.resolve(opts.repoRoot?.trim() || process.cwd());
  const userGoal = opts.userGoal?.trim();
  const projectName = opts.projectName?.trim() || path.basename(repoRoot);

  if (!userGoal) {
    throw new Error("userGoal required");
  }

  const steps = await planCodeClawRun({
    repoRoot,
    projectName,
    userGoal,
    agentBaseDir: opts.agentBaseDir,
  });

  if (opts.json) {
    runtime.log(JSON.stringify({ repoRoot, projectName, userGoal, steps }, null, 2));
    return;
  }

  runtime.log(`CodeClaw run plan for ${projectName}:`);
  for (const step of steps) {
    runtime.log(
      `- [${step.phase}] ${step.role} -> #${step.taskId} ${step.taskTitle} (${step.agentId})`,
    );
  }
}

export async function codeClawNextCommand(
  opts: {
    repoRoot?: string;
    agentBaseDir?: string;
    json?: boolean;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const repoRoot = path.resolve(opts.repoRoot?.trim() || process.cwd());
  const step = await getNextCodeClawStep({
    repoRoot,
    agentBaseDir: opts.agentBaseDir,
  });

  if (opts.json) {
    runtime.log(JSON.stringify(step, null, 2));
    return;
  }

  if (!step) {
    runtime.log("All tasks complete");
    return;
  }

  runtime.log(
    `Next step: [${step.phase}] ${step.role} -> #${step.taskId} ${step.taskTitle} (${step.agentId})`,
  );
}

export async function codeClawBoardCommand(
  opts: {
    repoRoot?: string;
    json?: boolean;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const repoRoot = path.resolve(opts.repoRoot?.trim() || process.cwd());
  const board = await readBoard(repoRoot);

  if (!board) {
    if (opts.json) {
      runtime.log(JSON.stringify(null, null, 2));
      return;
    }
    runtime.log("Board not initialized");
    return;
  }

  if (opts.json) {
    runtime.log(JSON.stringify(board, null, 2));
    return;
  }

  runtime.log(formatBoardMarkdown(board).trimEnd());
}

export async function codeClawExecuteCommand(
  opts: {
    repoRoot?: string;
    agentBaseDir?: string;
    json?: boolean;
    spawn?: boolean;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const repoRoot = path.resolve(opts.repoRoot?.trim() || process.cwd());
  const execution = await prepareNextExecution({
    repoRoot,
    agentBaseDir: opts.agentBaseDir,
  });

  if (!execution) {
    if (opts.json) {
      runtime.log(JSON.stringify({ done: true }, null, 2));
      return;
    }
    runtime.log("All tasks complete");
    return;
  }

  if (opts.spawn) {
    const { callGateway, randomIdempotencyKey } = await import("./codeclaw.gateway.runtime.js");
    const response = await callGateway({
      method: "agent",
      params: {
        message: execution.spawnParams.task,
        agentId: execution.spawnParams.agentId,
        model: execution.spawnParams.model,
        extraSystemPrompt: execution.spawnParams.systemPromptAddition,
        label: execution.spawnParams.label,
        idempotencyKey: randomIdempotencyKey(),
      },
      expectFinal: true,
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            step: execution.step,
            spawnParams: execution.spawnParams,
            gateway: response,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log(
      `Spawned [${execution.step.phase}] ${execution.step.role} for task #${execution.step.taskId} (${execution.spawnParams.agentId})`,
    );
    return;
  }

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          step: execution.step,
          spawnParams: execution.spawnParams,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(
    `Prepared [${execution.step.phase}] ${execution.step.role} for task #${execution.step.taskId} (${execution.spawnParams.agentId})`,
  );
  runtime.log(`Label: ${execution.spawnParams.label}`);
  runtime.log("Use --spawn to launch this step via gateway.");
}

export async function codeClawCompleteCommand(
  opts: {
    repoRoot?: string;
    taskId: number;
    success?: boolean;
    notes?: string;
    json?: boolean;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const repoRoot = path.resolve(opts.repoRoot?.trim() || process.cwd());
  await completeExecution({
    repoRoot,
    taskId: opts.taskId,
    success: opts.success ?? true,
    notes: opts.notes,
  });
  if (opts.json) {
    runtime.log(
      JSON.stringify(
        { completed: true, taskId: opts.taskId, success: opts.success ?? true },
        null,
        2,
      ),
    );
    return;
  }
  runtime.log(`Task #${opts.taskId} marked as ${opts.success === false ? "blocked" : "done"}`);
}

export async function codeClawRunAllCommand(
  opts: {
    repoRoot?: string;
    userGoal: string;
    projectName?: string;
    agentBaseDir?: string;
    json?: boolean;
    dryRun?: boolean;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const repoRoot = path.resolve(opts.repoRoot?.trim() || process.cwd());

  runtime.log("Planning run...");
  const steps = await planCodeClawRun({
    repoRoot,
    projectName: opts.projectName ?? path.basename(repoRoot),
    userGoal: opts.userGoal,
    agentBaseDir: opts.agentBaseDir,
  });

  runtime.log(`Planned ${steps.length} steps across ${new Set(steps.map((step) => step.phase)).size} phases`);

  if (opts.dryRun) {
    for (const step of steps) {
      runtime.log(`  [${step.phase}] ${step.role} — Task #${step.taskId}: ${step.taskTitle}`);
    }
    runtime.log("Dry run complete. Use without --dry-run to execute.");
    return;
  }

  let completed = 0;
  while (true) {
    const execution = await prepareNextExecution({
      repoRoot,
      agentBaseDir: opts.agentBaseDir,
    });

    if (!execution) {
      runtime.log(`All ${completed} tasks complete.`);
      break;
    }

    runtime.log(
      `[${execution.step.phase}] Spawning ${execution.step.role} for task #${execution.step.taskId}: ${execution.step.taskTitle}`,
    );

    const { callGateway, randomIdempotencyKey } = await import("./codeclaw.gateway.runtime.js");
    await callGateway({
      method: "agent",
      params: {
        message: execution.spawnParams.task,
        agentId: execution.spawnParams.agentId,
        model: execution.spawnParams.model,
        extraSystemPrompt: execution.spawnParams.systemPromptAddition,
        label: execution.spawnParams.label,
        idempotencyKey: randomIdempotencyKey(),
      },
      expectFinal: true,
    });

    await completeExecution({
      repoRoot,
      taskId: execution.step.taskId,
      success: true,
    });

    completed++;
    runtime.log(`  ✓ Task #${execution.step.taskId} complete (${completed}/${steps.length})`);
  }

  if (opts.json) {
    runtime.log(JSON.stringify({ completed, total: steps.length }, null, 2));
  }
}
