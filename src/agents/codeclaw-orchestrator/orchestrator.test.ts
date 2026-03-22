import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initBoard, readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { createTask, moveTask } from "../codeclaw-board/board-ops.js";
import { writeOrchestratorState, readOrchestratorState } from "./orchestrator-io.js";
import {
  advancePhase,
  buildPMDirective,
  buildRoleDirective,
  buildTeamLeadBrief,
  initOrchestrator,
} from "./orchestrator.js";
import type { OrchestratorState } from "./types.js";

const tempRoots: string[] = [];

async function makeRepoRoot(): Promise<string> {
  const repoRoot = path.join(
    os.tmpdir(),
    `codeclaw-orchestrator-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(repoRoot, { recursive: true });
  tempRoots.push(repoRoot);
  return repoRoot;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("codeclaw orchestrator", () => {
  it("initOrchestrator creates state with requirements phase", async () => {
    const repoRoot = await makeRepoRoot();

    const state = await initOrchestrator({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship hierarchy-aware orchestrator",
    });

    expect(state.currentPhase).toBe("requirements");
    expect(state.phaseHistory).toHaveLength(1);
    expect(state.phaseHistory[0]?.phase).toBe("requirements");
    expect(state.userGoal).toBe("Ship hierarchy-aware orchestrator");

    const board = await readBoard(repoRoot);
    expect(board).not.toBeNull();
  });

  it("advancePhase moves requirements to planning when BA tasks are done", async () => {
    const repoRoot = await makeRepoRoot();
    const state = await initOrchestrator({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Define requirements",
    });

    const board = await initBoard(repoRoot, "CodeClaw");
    const baTask = createTask(board, {
      title: "Gather requirements",
      assignedRole: "business-analyst",
    });
    moveTask(board, baTask.id, "done");
    await writeBoard(board);

    const phase = await advancePhase(state);

    expect(phase).toBe("planning");
    expect(state.phaseHistory.at(-1)?.phase).toBe("planning");
  });

  it("advancePhase moves development to testing when dev tasks are in-review", async () => {
    const repoRoot = await makeRepoRoot();
    await initBoard(repoRoot, "CodeClaw");

    const state: OrchestratorState = {
      projectName: "CodeClaw",
      repoRoot,
      currentPhase: "development",
      userGoal: "Implement feature",
      phaseHistory: [{ phase: "development", startedAt: new Date().toISOString() }],
    };
    await writeOrchestratorState(state);

    const board = (await readBoard(repoRoot))!;
    const devTask = createTask(board, { title: "Implement change", assignedRole: "developer" });
    moveTask(board, devTask.id, "in-review");
    await writeBoard(board);

    const phase = await advancePhase(state);

    expect(phase).toBe("testing");
    expect(state.phaseHistory.at(-1)?.phase).toBe("testing");
  });

  it("advancePhase moves to done when all tasks are done", async () => {
    const repoRoot = await makeRepoRoot();
    const board = await initBoard(repoRoot, "CodeClaw");

    const devTask = createTask(board, { title: "Implement", assignedRole: "developer" });
    const qaTask = createTask(board, { title: "Validate", assignedRole: "tester" });
    moveTask(board, devTask.id, "done");
    moveTask(board, qaTask.id, "done");
    await writeBoard(board);

    const state: OrchestratorState = {
      projectName: "CodeClaw",
      repoRoot,
      currentPhase: "testing",
      userGoal: "Ship",
      phaseHistory: [{ phase: "testing", startedAt: new Date().toISOString() }],
    };

    const phase = await advancePhase(state);

    expect(phase).toBe("done");
    expect(state.phaseHistory.at(-1)?.phase).toBe("done");
  });

  it("buildTeamLeadBrief includes user goal and repo context", () => {
    const state: OrchestratorState = {
      projectName: "CodeClaw",
      repoRoot: "/repo",
      currentPhase: "planning",
      userGoal: "Build orchestrator",
      phaseHistory: [{ phase: "planning", startedAt: new Date().toISOString() }],
    };

    const brief = buildTeamLeadBrief(state, "2 tasks in backlog");

    expect(brief).toContain("Build orchestrator");
    expect(brief).toContain("2 tasks in backlog");
  });

  it("buildPMDirective includes task breakdown", () => {
    const state: OrchestratorState = {
      projectName: "CodeClaw",
      repoRoot: "/repo",
      currentPhase: "planning",
      userGoal: "Build orchestrator",
      phaseHistory: [{ phase: "planning", startedAt: new Date().toISOString() }],
    };

    const directive = buildPMDirective(state, "#1 BA spec\n#2 Dev implementation");

    expect(directive).toContain("#1 BA spec");
    expect(directive).toContain("#2 Dev implementation");
  });

  it("buildRoleDirective includes task title, acceptance criteria, and context slice", () => {
    const directive = buildRoleDirective({
      role: "developer",
      taskTitle: "Implement orchestrator",
      taskId: 12,
      acceptanceCriteria: ["Adds phase transitions", "Persists state"],
      contextSlice: "Read board-ops.ts and board-io.ts",
      boardState: "Task #12 in-progress",
    });

    expect(directive).toContain("Task Title: Implement orchestrator");
    expect(directive).toContain("- Adds phase transitions");
    expect(directive).toContain("Read board-ops.ts and board-io.ts");
  });

  it("readOrchestratorState and writeOrchestratorState round-trip", async () => {
    const repoRoot = await makeRepoRoot();
    const state: OrchestratorState = {
      projectName: "CodeClaw",
      repoRoot,
      currentPhase: "requirements",
      userGoal: "Define scope",
      architectureNotes: "Use board-driven phase transitions",
      phaseHistory: [{ phase: "requirements", startedAt: new Date().toISOString() }],
    };

    await writeOrchestratorState(state);
    const loaded = await readOrchestratorState(repoRoot);

    expect(loaded).toEqual(state);
  });
});
