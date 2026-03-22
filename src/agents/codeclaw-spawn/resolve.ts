import os from "node:os";
import path from "node:path";
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
  boardSummary: string;
}): string {
  return [
    "# Role Prompt",
    params.rolePrompt,
    "",
    "# Memory Context",
    params.memoryMarkdown,
    "",
    "# Board Awareness Instructions",
    "- Read .codeclaw/board.md before starting implementation work.",
    "- Keep task status accurate when you begin, block, or finish work.",
    "- If blocked, write the blocker and the exact dependency in board task notes.",
    "- Cross-check your assigned task against board scope before editing.",
    "",
    "Current Board Snapshot:",
    params.boardSummary,
  ].join("\n");
}

export async function resolveCodeClawSpawn(params: {
  role: CodeClawRole;
  repoRoot: string;
  taskTitle: string;
  taskId: number;
  objective: string;
  acceptanceCriteria: string[];
  constraints?: string[];
  agentBaseDir?: string;
  contextSlice?: string;
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

  const memoryState = await readRoleMemory(config.agentDir, params.role);
  const memoryMarkdown = memoryState
    ? formatRoleMemoryMarkdown(memoryState).trimEnd()
    : "No memory state found yet. Initialize by writing current focus and active tasks.";

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
      boardSummary,
    }),
    taskDirective: formatTaskDirective({
      role: params.role,
      taskTitle: params.taskTitle,
      taskId: params.taskId,
      objective: params.objective,
      acceptanceCriteria,
      constraints,
      contextSlice: params.contextSlice,
      boardSummary,
    }),
    allowedTools: config.allowedTools,
  };
}
