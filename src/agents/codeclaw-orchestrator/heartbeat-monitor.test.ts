import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { moveTask } from "../codeclaw-board/board-ops.js";
import { prepareNextExecution } from "./execute.js";
import { runHeartbeatCheck } from "./heartbeat-monitor.js";
import { planCodeClawRun } from "./runner.js";

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

describe("codeclaw heartbeat monitor", () => {
  it("returns unhealthy for uninitialized state", async () => {
    const repoRoot = await makeTempDir("codeclaw-heartbeat-repo");
    const result = await runHeartbeatCheck({ repoRoot });

    expect(result.healthy).toBe(false);
    expect(result.report).toBeNull();
    expect(result.warnings[0]).toContain("not initialized");
  });

  it("returns healthy when tasks are in progress", async () => {
    const repoRoot = await makeTempDir("codeclaw-heartbeat-repo");
    const agentBaseDir = await makeTempDir("codeclaw-heartbeat-agents");

    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship heartbeat checks",
      agentBaseDir,
    });
    await prepareNextExecution({ repoRoot, agentBaseDir });

    const result = await runHeartbeatCheck({ repoRoot });
    expect(result.healthy).toBe(true);
    expect(result.report?.agents.length).toBe(1);
  });

  it("warns when no agents are running while tasks remain", async () => {
    const repoRoot = await makeTempDir("codeclaw-heartbeat-repo");
    const agentBaseDir = await makeTempDir("codeclaw-heartbeat-agents");

    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship heartbeat checks",
      agentBaseDir,
    });

    const result = await runHeartbeatCheck({ repoRoot });
    expect(result.warnings.some((warning) => warning.includes("No agents are currently running"))).toBe(
      true,
    );
  });

  it("reports all-complete when every task is done", async () => {
    const repoRoot = await makeTempDir("codeclaw-heartbeat-repo");
    const agentBaseDir = await makeTempDir("codeclaw-heartbeat-agents");

    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship heartbeat checks",
      agentBaseDir,
    });

    const board = await readBoard(repoRoot);
    if (!board) {
      throw new Error("Expected board to exist");
    }
    for (const task of board.tasks) {
      moveTask(board, task.id, "done");
    }
    await writeBoard(board);

    const result = await runHeartbeatCheck({ repoRoot });
    expect(result.actions).toContain("All tasks complete.");
    expect(result.report?.completedTasks).toBe(result.report?.totalTasks);
  });
});
