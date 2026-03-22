import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { prepareNextExecution } from "./execute.js";
import { handleStalledAgents, buildProgressReport, parseCodeClawLabel } from "./progress.js";
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

describe("codeclaw orchestrator progress", () => {
  it("parseCodeClawLabel parses role and task id", () => {
    expect(parseCodeClawLabel("codeclaw-developer-task-5")).toEqual({
      role: "developer",
      taskId: 5,
    });
    expect(parseCodeClawLabel("codeclaw-invalid-role-task-1")).toBeNull();
    expect(parseCodeClawLabel("not-a-label")).toBeNull();
  });

  it("buildProgressReport returns phase and in-progress agents", async () => {
    const repoRoot = await makeTempDir("codeclaw-progress-repo");
    const agentBaseDir = await makeTempDir("codeclaw-progress-agents");

    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship progress reporting",
      agentBaseDir,
    });
    await prepareNextExecution({ repoRoot, agentBaseDir });

    const report = await buildProgressReport({ repoRoot });
    expect(report).not.toBeNull();
    expect(report?.phase).toBeTypeOf("string");
    expect(report?.agents).toHaveLength(1);
    expect(report?.agents[0]?.label).toBe("codeclaw-business-analyst-task-1");
    expect(report?.completedTasks).toBe(0);
    expect(report?.totalTasks).toBe(6);
  });

  it("handleStalledAgents marks stalled tasks as blocked", async () => {
    const repoRoot = await makeTempDir("codeclaw-progress-repo");
    const agentBaseDir = await makeTempDir("codeclaw-progress-agents");

    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship stalled-task handling",
      agentBaseDir,
    });
    await prepareNextExecution({ repoRoot, agentBaseDir });

    const board = await readBoard(repoRoot);
    if (!board) {
      throw new Error("Expected board to exist");
    }
    const task = board.tasks.find((entry) => entry.id === 1);
    if (!task) {
      throw new Error("Expected task #1");
    }
    task.updatedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    await writeBoard(board);

    const changed = await handleStalledAgents({
      repoRoot,
      stalledLabels: ["codeclaw-business-analyst-task-1"],
    });
    expect(changed).toBe(1);

    const updated = await readBoard(repoRoot);
    const stalled = updated?.tasks.find((entry) => entry.id === 1);
    expect(stalled?.status).toBe("blocked");
    expect(stalled?.blockers.some((item) => item.includes("Stalled agent heartbeat overdue"))).toBe(
      true,
    );
  });

  it("buildProgressReport returns null for uninitialized state", async () => {
    const repoRoot = await makeTempDir("codeclaw-progress-repo");
    const report = await buildProgressReport({ repoRoot });
    expect(report).toBeNull();
  });
});
