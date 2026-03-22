import { access, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { createTask, moveTask } from "../codeclaw-board/board-ops.js";
import { writeOrchestratorState } from "../codeclaw-orchestrator/orchestrator-io.js";
import { buildRoleHeartbeat } from "./heartbeat.js";
import {
  addMemoryAction,
  formatRoleMemoryMarkdown,
  initRoleMemory,
  readRoleMemory,
  writeRoleMemory,
} from "./memory-io.js";
import type { RoleMemoryState } from "./types.js";

const tempRoots: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("codeclaw memory", () => {
  it("initRoleMemory creates valid initial state", async () => {
    const agentDir = await makeTempDir("codeclaw-memory-agent");

    const state = await initRoleMemory(agentDir, "developer");

    expect(state.role).toBe("developer");
    expect(state.activeTaskIds).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(state.recentActions).toEqual([]);
    expect(state.notes).toEqual([]);

    await access(path.join(agentDir, "memory-state.json"));
    await access(path.join(agentDir, "MEMORY.md"));
  });

  it("addMemoryAction appends entries with timestamps", () => {
    const state: RoleMemoryState = {
      role: "tester",
      lastUpdated: new Date(0).toISOString(),
      activeTaskIds: [],
      blockers: [],
      recentActions: [],
      notes: [],
    };

    addMemoryAction(state, {
      action: "Validated task",
      details: "Ran targeted regression suite",
      taskId: 42,
    });

    expect(state.recentActions).toHaveLength(1);
    expect(state.recentActions[0]?.action).toBe("Validated task");
    expect(state.recentActions[0]?.details).toBe("Ran targeted regression suite");
    expect(state.recentActions[0]?.taskId).toBe(42);
    expect(new Date(state.recentActions[0].timestamp).toString()).not.toBe("Invalid Date");
    expect(new Date(state.lastUpdated).toString()).not.toBe("Invalid Date");
  });

  it("addMemoryAction trims to max 50 entries", () => {
    const state: RoleMemoryState = {
      role: "project-manager",
      lastUpdated: new Date(0).toISOString(),
      activeTaskIds: [],
      blockers: [],
      recentActions: [],
      notes: [],
    };

    for (let index = 1; index <= 60; index += 1) {
      addMemoryAction(state, {
        action: `Action ${index}`,
      });
    }

    expect(state.recentActions).toHaveLength(50);
    expect(state.recentActions[0]?.action).toBe("Action 11");
    expect(state.recentActions.at(-1)?.action).toBe("Action 60");
  });

  it("formatRoleMemoryMarkdown includes all sections", () => {
    const markdown = formatRoleMemoryMarkdown({
      role: "team-lead",
      lastUpdated: "2026-03-22T00:00:00.000Z",
      currentFocus: "Resolve QA escalation",
      activeTaskIds: [1, 2],
      blockers: ["Waiting for flaky test repro"],
      recentActions: [
        {
          timestamp: "2026-03-22T00:01:00.000Z",
          action: "Delegated testing",
          details: "Asked tester to validate task #2",
          taskId: 2,
        },
      ],
      notes: ["Keep reviewer independent for final sign-off"],
      waitingOn: {
        role: "tester",
        reason: "Need regression evidence",
      },
    });

    expect(markdown).toContain("## Current Focus");
    expect(markdown).toContain("## Active Tasks");
    expect(markdown).toContain("## Blockers");
    expect(markdown).toContain("## Waiting On");
    expect(markdown).toContain("## Recent Actions");
    expect(markdown).toContain("## Notes & Decisions");
  });

  it("readRoleMemory and writeRoleMemory round-trip", async () => {
    const agentDir = await makeTempDir("codeclaw-memory-roundtrip");
    const state: RoleMemoryState = {
      role: "business-analyst",
      lastUpdated: "2026-03-22T00:00:00.000Z",
      currentFocus: "Clarify acceptance criteria",
      activeTaskIds: [3],
      blockers: ["Need PM clarification"],
      recentActions: [
        {
          timestamp: "2026-03-22T00:01:00.000Z",
          action: "Asked clarification",
          details: "Questioned edge-case behavior",
          taskId: 3,
        },
      ],
      notes: ["Criteria must include error handling"],
      waitingOn: {
        role: "project-manager",
        reason: "Awaiting response from Team Lead",
      },
    };

    await writeRoleMemory(agentDir, state);

    const loaded = await readRoleMemory(agentDir, "business-analyst");

    expect(loaded).not.toBeNull();
    expect(loaded?.role).toBe("business-analyst");
    expect(loaded?.currentFocus).toBe("Clarify acceptance criteria");
    expect(loaded?.activeTaskIds).toEqual([3]);
    expect(loaded?.waitingOn?.role).toBe("project-manager");
  });

  it("writeRoleMemory generates both memory-state.json and MEMORY.md", async () => {
    const agentDir = await makeTempDir("codeclaw-memory-files");
    const state: RoleMemoryState = {
      role: "reviewer",
      lastUpdated: "2026-03-22T00:00:00.000Z",
      currentFocus: "Review architecture fit",
      activeTaskIds: [5],
      blockers: [],
      recentActions: [],
      notes: [],
    };

    await writeRoleMemory(agentDir, state);

    await access(path.join(agentDir, "memory-state.json"));
    await access(path.join(agentDir, "MEMORY.md"));

    const markdown = await readFile(path.join(agentDir, "MEMORY.md"), "utf8");
    expect(markdown).toContain("Review architecture fit");
  });

  it("buildRoleHeartbeat returns heartbeat prompt with memory and board context", async () => {
    const repoRoot = await makeTempDir("codeclaw-memory-heartbeat-repo");
    const agentDir = await makeTempDir("codeclaw-memory-heartbeat-agent");

    const board = await initBoard(repoRoot, "CodeClaw");
    const devTask = createTask(board, {
      title: "Implement memory heartbeat",
      assignedRole: "developer",
    });
    const qaTask = createTask(board, {
      title: "Validate memory heartbeat",
      assignedRole: "tester",
    });
    moveTask(board, qaTask.id, "blocked");
    const qaBoardTask = board.tasks.find((task) => task.id === qaTask.id);
    if (!qaBoardTask) {
      throw new Error("Expected QA task to exist on board");
    }
    qaBoardTask.blockers.push("Waiting on developer handoff");
    await writeBoard(board);

    await writeOrchestratorState({
      projectName: "CodeClaw",
      repoRoot,
      currentPhase: "development",
      userGoal: "Ship memory-first heartbeat",
      phaseHistory: [{ phase: "development", startedAt: new Date().toISOString() }],
    });

    const memory = await initRoleMemory(agentDir, "developer");
    memory.currentFocus = "Task handoff prep";
    memory.activeTaskIds = [devTask.id];
    addMemoryAction(memory, {
      action: "Started implementation",
      details: "Added memory module",
      taskId: devTask.id,
    });
    await writeRoleMemory(agentDir, memory);

    const heartbeat = await buildRoleHeartbeat({
      agentDir,
      role: "developer",
      repoRoot,
    });

    expect(heartbeat).toContain("Heartbeat Check");
    expect(heartbeat).toContain("Task handoff prep");
    expect(heartbeat).toContain("Orchestrator Phase: development");
    expect(heartbeat).toContain(`#${devTask.id}`);
    expect(heartbeat).toContain("Blocked tasks: 1");
  });

  it("buildRoleHeartbeat handles missing memory gracefully", async () => {
    const repoRoot = await makeTempDir("codeclaw-memory-first-session-repo");
    const agentDir = await makeTempDir("codeclaw-memory-first-session-agent");

    await initBoard(repoRoot, "CodeClaw");

    const heartbeat = await buildRoleHeartbeat({
      agentDir,
      role: "tester",
      repoRoot,
    });

    expect(heartbeat).toContain("No memory found - this is your first session");
    expect(heartbeat).toContain("Orchestrator Phase: unknown");
  });
});
