import os from "node:os";
import path from "node:path";
import { selectAlphaIotaContextByStrategy } from "../../context-engine/alphai-context-slice.js";
import { getDefaultCodeClawAgentConfigs } from "../codeclaw-agents/types.js";
import { formatBoardMarkdown } from "../codeclaw-board/board-format.js";
import type { CodeClawBoard } from "../codeclaw-board/types.js";
import { readRoleMemory, formatRoleMemoryMarkdown } from "../codeclaw-memory/memory-io.js";
import { buildRoleDirective } from "../codeclaw-orchestrator/orchestrator.js";
import { buildRolePrompt } from "../codeclaw-roles/prompts.js";
import {
  CODECLAW_ROLES,
  type CodeClawContextStrategy,
  type CodeClawRole,
} from "../codeclaw-roles/types.js";

export interface CodeClawSpawnConfig {
  role: CodeClawRole;
  agentId: string;
  displayName: string;
  model?: string;
  agentDir: string;
  contextStrategy: CodeClawContextStrategy;
  systemPromptAddition: string;
  taskDirective: string;
  allowedTools?: string[];
}

function resolveDefaultAgentBaseDir(): string {
  return path.join(os.homedir(), ".codeclaw", "agents");
}

function formatBoardSummaryFromTasks(repoRoot: string, boardSummary?: string): string {
  if (boardSummary?.trim()) {
    return boardSummary.trim();
  }

  const emptyBoard: CodeClawBoard = {
    projectName: path.basename(repoRoot),
    repoRoot,
    tasks: [],
    nextTaskId: 1,
  };

  return formatBoardMarkdown(emptyBoard).trimEnd();
}

function formatTaskDirective(params: {
  role: CodeClawRole;
  taskTitle: string;
  taskId: number;
  objective: string;
  acceptanceCriteria: string[];
  constraints: string[];
  contextSlice?: string;
  boardSummary: string;
}): string {
  const constraints = params.constraints.map((value) => value.trim()).filter(Boolean);

  const lines = [
    "# CodeClaw Task",
    "",
    `Objective: ${params.objective.trim()}`,
    "",
    buildRoleDirective({
      role: params.role,
      taskTitle: params.taskTitle,
      taskId: params.taskId,
      acceptanceCriteria: params.acceptanceCriteria,
      contextSlice: params.contextSlice,
      boardState: params.boardSummary,
    }),
  ];

  if (constraints.length > 0) {
    lines.push("", "Constraints:", ...constraints.map((item) => `- ${item}`));
  }

  return lines.join("\n").trim();
}

function formatSystemPromptAddition(params: {
  rolePrompt: string;
  memoryMarkdown: string;
  learningsContent: string;
  boardSummary: string;
  alphaIotaContext?: string;
  alphaIotaWarning?: string;
}): string {
  const sections = [
    "# Role Prompt",
    params.rolePrompt,
    "",
    "# AlphaIota Codebase Context",
    params.alphaIotaContext
      ? params.alphaIotaContext
      : "No AlphaIota context available for this role/strategy.",
    params.alphaIotaWarning ?? "",
    "",
    "# Memory Context",
    params.memoryMarkdown,
    "",
    "# Learnings (Your Knowledge Base)",
    "Read this FIRST — you may have already solved what you are about to investigate.",
    params.learningsContent,
    "",
    "# Board Awareness Instructions",
    "- Read .codeclaw/board.md before starting implementation work.",
    "- Keep task status accurate when you begin, block, or finish work.",
    "- If blocked, write the blocker and the exact dependency in board task notes.",
    "- Cross-check your assigned task against board scope before editing.",
    "",
    "Current Board Snapshot:",
    params.boardSummary,
  ];
  return sections.join("\n");
}

/**
 * Resolve spawn configuration for a CodeClaw role agent.
 *
 * AlphaIota context is fetched **automatically** based on the role's context
 * strategy — callers never need to supply it.  The only way to skip context
 * is if the strategy is "state-only" or AlphaIota artifacts don't exist in
 * the repo (which triggers a clear warning in the directive).
 */
export async function resolveCodeClawSpawn(params: {
  role: CodeClawRole;
  repoRoot: string;
  taskTitle: string;
  taskId: number;
  objective: string;
  acceptanceCriteria: string[];
  constraints?: string[];
  agentBaseDir?: string;
  boardSummary?: string;
}): Promise<CodeClawSpawnConfig> {
  const agentBaseDir = params.agentBaseDir ?? resolveDefaultAgentBaseDir();
  const configs = getDefaultCodeClawAgentConfigs(agentBaseDir);
  const config = configs.find((entry) => entry.role === params.role);

  if (!config) {
    throw new Error(`Missing CodeClaw agent config for role: ${params.role}`);
  }

  const contextStrategy = CODECLAW_ROLES[params.role].contextStrategy;
  const acceptanceCriteria = params.acceptanceCriteria.map((value) => value.trim()).filter(Boolean);
  const constraints = (params.constraints ?? []).map((value) => value.trim()).filter(Boolean);
  const rolePrompt = buildRolePrompt(params.role, {
    objective: params.objective,
    acceptanceCriteria,
    constraints,
  });

  // --- Mandatory AlphaIota context fetch ---
  // Every role agent gets context sliced by its strategy. "state-only" roles
  // (e.g. PM) skip this intentionally — they operate on board/orchestrator
  // state only, not source code.
  const contextPrompt = `${params.objective} ${params.taskTitle} ${acceptanceCriteria.join(" ")}`;
  const alphaIotaSlice = await selectAlphaIotaContextByStrategy({
    repoRoot: params.repoRoot,
    prompt: contextPrompt,
    strategy: contextStrategy,
  });

  const contextSlice = alphaIotaSlice?.systemPromptAddition ?? undefined;
  const alphaIotaWarning =
    contextStrategy !== "state-only" && !alphaIotaSlice
      ? "\n\n⚠️ WARNING: AlphaIota context unavailable — run `alphai` on this repo first. Operating without codebase intelligence."
      : "";

  const memoryState = await readRoleMemory(config.agentDir, params.role);
  const memoryMarkdown = memoryState
    ? formatRoleMemoryMarkdown(memoryState).trimEnd()
    : "No memory state found yet. Initialize by writing current focus and active tasks.";

  // Read LEARNINGS.md for this role
  let learningsContent = "No learnings recorded yet. Start documenting what you discover.";
  try {
    const { readFile } = await import("node:fs/promises");
    const learningsPath = (await import("node:path")).default.join(config.agentDir, "LEARNINGS.md");
    learningsContent = (await readFile(learningsPath, "utf8")).trim();
  } catch {
    // File doesn't exist yet — that's fine
  }

  const boardSummary = formatBoardSummaryFromTasks(params.repoRoot, params.boardSummary);

  return {
    role: params.role,
    agentId: config.agentId,
    displayName: config.displayName,
    model: config.defaultModel,
    agentDir: config.agentDir,
    contextStrategy,
    systemPromptAddition: formatSystemPromptAddition({
      rolePrompt,
      memoryMarkdown,
      learningsContent,
      boardSummary,
      alphaIotaContext: contextSlice,
      alphaIotaWarning,
    }),
    taskDirective: formatTaskDirective({
      role: params.role,
      taskTitle: params.taskTitle,
      taskId: params.taskId,
      objective: params.objective,
      acceptanceCriteria,
      constraints,
      contextSlice,
      boardSummary,
    }),
    allowedTools: config.allowedTools,
  };
}
