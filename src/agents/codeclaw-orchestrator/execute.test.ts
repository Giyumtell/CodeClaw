import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBoard, writeBoard } from "../codeclaw-board/board-io.js";
import { moveTask } from "../codeclaw-board/board-ops.js";
import { readRoleMemory } from "../codeclaw-memory/memory-io.js";
import { completeExecution, prepareNextExecution } from "./execute.js";
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

describe("codeclaw orchestrator execute", () => {
  it("prepareNextExecution returns spawn params after planning", async () => {
    const repoRoot = await makeTempDir("codeclaw-execute-repo");
    const agentBaseDir = await makeTempDir("codeclaw-execute-agents");
    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship execute workflow",
      agentBaseDir,
    });

    const result = await prepareNextExecution({ repoRoot, agentBaseDir });

    expect(result).not.toBeNull();
    expect(result?.spawnParams.agentId).toBeTypeOf("string");
    expect(result?.spawnParams.task).toContain("# CodeClaw Task");
    expect(result?.spawnParams.label).toContain(`task-${result?.step.taskId}`);

    const board = await readBoard(repoRoot);
    const task = board?.tasks.find((entry) => entry.id === result?.step.taskId);
    expect(task?.status).toBe("in-progress");

    const memory = await readRoleMemory(result!.spawn.agentDir, result!.step.role);
    expect(memory?.activeTaskIds.includes(result!.step.taskId)).toBe(true);
  });

  it("completeExecution moves task to done", async () => {
    const repoRoot = await makeTempDir("codeclaw-execute-repo");
    const agentBaseDir = await makeTempDir("codeclaw-execute-agents");
    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship execute workflow",
      agentBaseDir,
    });

    const result = await prepareNextExecution({ repoRoot, agentBaseDir });
    if (!result) {
      throw new Error("Expected a next execution step");
    }

    await completeExecution({
      repoRoot,
      taskId: result.step.taskId,
      success: true,
    });

    const board = await readBoard(repoRoot);
    const task = board?.tasks.find((entry) => entry.id === result.step.taskId);
    expect(task?.status).toBe("done");
  });

  it("prepareNextExecution returns null when no steps are left", async () => {
    const repoRoot = await makeTempDir("codeclaw-execute-repo");
    const agentBaseDir = await makeTempDir("codeclaw-execute-agents");
    await planCodeClawRun({
      repoRoot,
      projectName: "CodeClaw",
      userGoal: "Ship execute workflow",
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

    const result = await prepareNextExecution({ repoRoot, agentBaseDir });
    expect(result).toBeNull();
  });
});
