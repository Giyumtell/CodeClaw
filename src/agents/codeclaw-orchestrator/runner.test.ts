import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { moveTask } from "../codeclaw-board/board-ops.js";
import { getNextCodeClawStep, planCodeClawRun } from "./runner.js";

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

describe("codeclaw orchestrator runner", () => {
  it("planCodeClawRun creates 7 board tasks", async () => {
    const repoRoot = await makeTempDir("codeclaw-runner-repo");
    const agentBaseDir = await makeTempDir("codeclaw-runner-agents");

    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship full orchestrator",
      agentBaseDir,
    });

    const board = await readBoard(repoRoot);
    expect(board?.tasks).toHaveLength(7);
  });

  it("planCodeClawRun returns 7 steps in lifecycle order", async () => {
    const repoRoot = await makeTempDir("codeclaw-runner-repo");
    const agentBaseDir = await makeTempDir("codeclaw-runner-agents");

    const steps = await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship full orchestrator",
      agentBaseDir,
    });

    expect(steps).toHaveLength(7);
    expect(steps.map((step) => step.phase)).toEqual([
      "requirements",
      "planning",
      "development",
      "testing",
      "review",
      "security",
      "tracking",
    ]);
  });

  it("planCodeClawRun uses BA, TL, Dev, Tester, Reviewer, Security, PM role order", async () => {
    const repoRoot = await makeTempDir("codeclaw-runner-repo");
    const agentBaseDir = await makeTempDir("codeclaw-runner-agents");

    const steps = await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship full orchestrator",
      agentBaseDir,
    });

    expect(steps.map((step) => step.role)).toEqual([
      "business-analyst",
      "team-lead",
      "developer",
      "tester",
      "reviewer",
      "security",
      "project-manager",
    ]);
  });

  it("getNextCodeClawStep returns BA task in requirements phase", async () => {
    const repoRoot = await makeTempDir("codeclaw-runner-repo");
    const agentBaseDir = await makeTempDir("codeclaw-runner-agents");

    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship full orchestrator",
      agentBaseDir,
    });

    const step = await getNextCodeClawStep({ repoRoot, agentBaseDir });

    expect(step).not.toBeNull();
    expect(step?.role).toBe("business-analyst");
    expect(step?.phase).toBe("requirements");
  });

  it("getNextCodeClawStep returns null when all tasks are done", async () => {
    const repoRoot = await makeTempDir("codeclaw-runner-repo");
    const agentBaseDir = await makeTempDir("codeclaw-runner-agents");

    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship full orchestrator",
      agentBaseDir,
    });

    const board = await readBoard(repoRoot);
    if (!board) {
      throw new Error("Board missing");
    }

    for (const task of board.tasks) {
      moveTask(board, task.id, "done");
    }
    await writeBoard(board);

    const step = await getNextCodeClawStep({ repoRoot, agentBaseDir });
    expect(step).toBeNull();
  });
});
