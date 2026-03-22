import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CODECLAW_ROLES, type CodeClawRole } from "../codeclaw-roles/types.js";
import type { RoleMemoryEntry, RoleMemoryState } from "./types.js";

const MAX_RECENT_ACTIONS = 50;

function nowIso(): string {
  return new Date().toISOString();
}

function getMemoryStatePath(agentDir: string): string {
  return path.join(agentDir, "memory-state.json");
}

function getMemoryMarkdownPath(agentDir: string): string {
  return path.join(agentDir, "MEMORY.md");
}

export async function readRoleMemory(
  agentDir: string,
  role: CodeClawRole,
): Promise<RoleMemoryState | null> {
  const memoryPath = getMemoryStatePath(agentDir);

  try {
    const raw = await readFile(memoryPath, "utf8");
    const state = JSON.parse(raw) as RoleMemoryState;

    if (state.role !== role) {
      return {
        ...state,
        role,
      };
    }

    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function addMemoryAction(
  state: RoleMemoryState,
  entry: Omit<RoleMemoryEntry, "timestamp">,
): void {
  state.recentActions.push({
    timestamp: nowIso(),
    ...entry,
  });

  if (state.recentActions.length > MAX_RECENT_ACTIONS) {
    state.recentActions = state.recentActions.slice(-MAX_RECENT_ACTIONS);
  }

  state.lastUpdated = nowIso();
}

export function formatRoleMemoryMarkdown(state: RoleMemoryState): string {
  const roleDisplayName = CODECLAW_ROLES[state.role].displayName;
  const lines: string[] = [
    `# ${roleDisplayName} Memory — Last Updated: ${state.lastUpdated}`,
    "",
    "## Current Focus",
    state.currentFocus?.trim() || "No active focus",
    "",
    "## Active Tasks",
  ];

  if (state.activeTaskIds.length === 0) {
    lines.push("- (none)");
  } else {
    for (const taskId of state.activeTaskIds) {
      lines.push(`- #${taskId} — Task details are tracked on the board`);
    }
  }

  lines.push("", "## Blockers");

  if (state.blockers.length === 0) {
    lines.push("- (none)");
  } else {
    for (const blocker of state.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  lines.push("", "## Waiting On");

  if (state.waitingOn) {
    const waitingRole = CODECLAW_ROLES[state.waitingOn.role].displayName;
    lines.push(`- ${waitingRole}: ${state.waitingOn.reason}`);
  } else {
    lines.push("- (none)");
  }

  lines.push("", "## Recent Actions");

  if (state.recentActions.length === 0) {
    lines.push("- (none)");
  } else {
    for (const action of state.recentActions) {
      const detailSuffix = action.details ? `: ${action.details}` : "";
      const taskSuffix = action.taskId ? ` (task #${action.taskId})` : "";
      lines.push(`- [${action.timestamp}] ${action.action}${taskSuffix}${detailSuffix}`);
    }
  }

  lines.push("", "## Notes & Decisions");

  if (state.notes.length === 0) {
    lines.push("- (none)");
  } else {
    for (const note of state.notes) {
      lines.push(`- ${note}`);
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function writeRoleMemory(agentDir: string, state: RoleMemoryState): Promise<void> {
  state.lastUpdated = nowIso();

  const memoryStatePath = getMemoryStatePath(agentDir);
  const memoryMarkdownPath = getMemoryMarkdownPath(agentDir);

  await writeFile(memoryStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await writeFile(memoryMarkdownPath, formatRoleMemoryMarkdown(state), "utf8");
}

export async function initRoleMemory(
  agentDir: string,
  role: CodeClawRole,
): Promise<RoleMemoryState> {
  const existing = await readRoleMemory(agentDir, role);
  if (existing) {
    return existing;
  }

  const state: RoleMemoryState = {
    role,
    lastUpdated: nowIso(),
    currentFocus: "",
    activeTaskIds: [],
    blockers: [],
    recentActions: [],
    notes: [],
  };

  await writeRoleMemory(agentDir, state);
  return state;
}
