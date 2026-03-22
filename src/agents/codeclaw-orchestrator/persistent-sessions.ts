import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PersistentRole =
  | "team-lead"
  | "project-manager"
  | "business-analyst"
  | "security";

export const PERSISTENT_ROLES: PersistentRole[] = [
  "team-lead",
  "project-manager",
  "business-analyst",
  "security",
];

export interface PersistentSessionRecord {
  role: PersistentRole;
  sessionKey?: string;
  label: string;
  agentId: string;
  spawnedAt: string;
  lastActiveAt: string;
  active: boolean;
}

export interface PersistentSessionsState {
  projectName: string;
  repoRoot: string;
  sessions: Record<PersistentRole, PersistentSessionRecord | null>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveSessionsPath(repoRoot: string): string {
  return path.join(repoRoot, ".codeclaw", "sessions.json");
}

export function createPersistentSessionsState(
  projectName: string,
  repoRoot: string,
): PersistentSessionsState {
  return {
    projectName,
    repoRoot,
    sessions: {
      "team-lead": null,
      "project-manager": null,
      "business-analyst": null,
      security: null,
    },
  };
}

function normalizeState(raw: Partial<PersistentSessionsState>): PersistentSessionsState | null {
  if (!raw || typeof raw.projectName !== "string" || typeof raw.repoRoot !== "string") {
    return null;
  }

  const sessions = raw.sessions ?? {};
  return {
    projectName: raw.projectName,
    repoRoot: raw.repoRoot,
    sessions: {
      "team-lead": sessions["team-lead"] ?? null,
      "project-manager": sessions["project-manager"] ?? null,
      "business-analyst": sessions["business-analyst"] ?? null,
      security: sessions.security ?? null,
    },
  };
}

function isPersistentRole(role: string): role is PersistentRole {
  return PERSISTENT_ROLES.includes(role as PersistentRole);
}

/**
 * Read persistent sessions state from .codeclaw/sessions.json
 */
export async function readPersistentSessions(
  repoRoot: string,
): Promise<PersistentSessionsState | null> {
  try {
    const raw = await readFile(resolveSessionsPath(repoRoot), "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistentSessionsState>;
    return normalizeState(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Write persistent sessions state
 */
export async function writePersistentSessions(
  repoRoot: string,
  state: PersistentSessionsState,
): Promise<void> {
  const filePath = resolveSessionsPath(repoRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/**
 * Check if a persistent role already has an active session.
 * If yes, return its session info so we can send messages to it instead of spawning new.
 */
export function getPersistentSession(
  state: PersistentSessionsState,
  role: PersistentRole,
): PersistentSessionRecord | null {
  const record = state.sessions[role];
  if (!record || !record.active) {
    return null;
  }
  return record;
}

/**
 * Register a newly spawned session for a persistent role.
 */
export function registerPersistentSession(
  state: PersistentSessionsState,
  role: PersistentRole,
  record: Omit<PersistentSessionRecord, "role">,
): void {
  state.sessions[role] = {
    role,
    ...record,
    lastActiveAt: record.lastActiveAt || nowIso(),
  };
}

/**
 * Mark a persistent session as inactive (ended/crashed).
 */
export function deactivatePersistentSession(
  state: PersistentSessionsState,
  role: PersistentRole,
): void {
  const record = state.sessions[role];
  if (!record) {
    return;
  }
  record.active = false;
  record.lastActiveAt = nowIso();
}

/**
 * Check if a role should use persistent session (send message) vs fresh spawn.
 * Returns "send" with sessionKey if active session exists, "spawn" if needs new one.
 */
export function resolveSessionAction(
  state: PersistentSessionsState,
  role: string,
): { action: "send"; sessionKey: string } | { action: "spawn" } {
  if (!isPersistentRole(role)) {
    return { action: "spawn" };
  }

  const existing = getPersistentSession(state, role);
  if (existing?.sessionKey?.trim()) {
    return { action: "send", sessionKey: existing.sessionKey };
  }

  return { action: "spawn" };
}
