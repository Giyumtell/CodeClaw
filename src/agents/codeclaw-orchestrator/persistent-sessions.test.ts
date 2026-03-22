import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPersistentSessionsState,
  deactivatePersistentSession,
  getPersistentSession,
  registerPersistentSession,
  resolveSessionAction,
  readPersistentSessions,
  writePersistentSessions,
} from "./persistent-sessions.js";

const tempRoots: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const root = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(root, { recursive: true });
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("persistent sessions", () => {
  it("writes and reads persistent sessions state", async () => {
    const repoRoot = await makeTempDir("codeclaw-persistent");
    const state = createPersistentSessionsState("Demo", repoRoot);

    registerPersistentSession(state, "team-lead", {
      sessionKey: "codeclaw-team-lead",
      label: "codeclaw-team-lead-task-2",
      agentId: "codeclaw-team-lead",
      spawnedAt: "2026-03-22T00:00:00.000Z",
      lastActiveAt: "2026-03-22T00:00:00.000Z",
      active: true,
    });

    await writePersistentSessions(repoRoot, state);
    const loaded = await readPersistentSessions(repoRoot);

    expect(loaded?.projectName).toBe("Demo");
    expect(loaded?.sessions["team-lead"]?.sessionKey).toBe("codeclaw-team-lead");
  });

  it("resolveSessionAction returns send for active persistent session", () => {
    const state = createPersistentSessionsState("Demo", "/repo/demo");
    registerPersistentSession(state, "business-analyst", {
      sessionKey: "codeclaw-business-analyst",
      label: "codeclaw-business-analyst-task-1",
      agentId: "codeclaw-business-analyst",
      spawnedAt: "2026-03-22T00:00:00.000Z",
      lastActiveAt: "2026-03-22T00:00:00.000Z",
      active: true,
    });

    expect(resolveSessionAction(state, "business-analyst")).toEqual({
      action: "send",
      sessionKey: "codeclaw-business-analyst",
    });
    expect(resolveSessionAction(state, "developer")).toEqual({ action: "spawn" });
  });

  it("deactivatePersistentSession marks record inactive", () => {
    const state = createPersistentSessionsState("Demo", "/repo/demo");
    registerPersistentSession(state, "security", {
      sessionKey: "codeclaw-security",
      label: "codeclaw-security-task-4",
      agentId: "codeclaw-security",
      spawnedAt: "2026-03-22T00:00:00.000Z",
      lastActiveAt: "2026-03-22T00:00:00.000Z",
      active: true,
    });

    deactivatePersistentSession(state, "security");

    expect(getPersistentSession(state, "security")).toBeNull();
    expect(resolveSessionAction(state, "security")).toEqual({ action: "spawn" });
  });
});
