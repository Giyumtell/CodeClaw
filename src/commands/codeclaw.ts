import fs from "node:fs/promises";
import path from "node:path";
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
  let project = state.projects.find((entry) => path.resolve(entry.repoRoot) === path.resolve(params.repoRoot));
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
    acceptanceCriteria: (params.acceptanceCriteria ?? []).map((value) => value.trim()).filter(Boolean),
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
    ? state.projects.filter((entry) => path.resolve(entry.repoRoot) === path.resolve(params.repoRoot!))
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
