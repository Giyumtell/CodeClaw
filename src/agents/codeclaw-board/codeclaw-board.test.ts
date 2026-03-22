import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatBoardMarkdown } from "./board-format.js";
import { initBoard, readBoard, writeBoard } from "./board-io.js";
import {
  addBlocker,
  assignTask,
  createTask,
  getTaskById,
  getTasksByStatus,
  moveTask,
  removeBlocker,
} from "./board-ops.js";
import type { CodeClawBoard } from "./types.js";

const tempRoots: string[] = [];

async function makeRepoRoot(): Promise<string> {
  const repoRoot = path.join(
    os.tmpdir(),
    `codeclaw-board-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(repoRoot, { recursive: true });
  tempRoots.push(repoRoot);
  return repoRoot;
}

function makeBoard(repoRoot: string): CodeClawBoard {
  return {
    projectName: "CodeClaw",
    repoRoot,
    tasks: [],
    nextTaskId: 1,
  };
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("codeclaw board", () => {
  it("initBoard creates board with empty tasks", async () => {
    const repoRoot = await makeRepoRoot();
    const board = await initBoard(repoRoot, "CodeClaw");

    expect(board.projectName).toBe("CodeClaw");
    expect(board.tasks).toEqual([]);
    expect(board.nextTaskId).toBe(1);

    const loaded = await readBoard(repoRoot);
    expect(loaded).toEqual(board);
  });

  it("createTask adds task with correct defaults", async () => {
    const repoRoot = await makeRepoRoot();
    const board = makeBoard(repoRoot);

    const task = createTask(board, { title: "Add board ops" });

    expect(task.id).toBe(1);
    expect(task.status).toBe("backlog");
    expect(task.acceptanceCriteria).toEqual([]);
    expect(task.constraints).toEqual([]);
    expect(task.blockers).toEqual([]);
    expect(board.nextTaskId).toBe(2);
    expect(task.createdAt).toBeTruthy();
    expect(task.updatedAt).toBeTruthy();
  });

  it("moveTask changes status", async () => {
    const repoRoot = await makeRepoRoot();
    const board = makeBoard(repoRoot);

    const task = createTask(board, { title: "Move me" });
    moveTask(board, task.id, "in-progress");

    expect(getTaskById(board, task.id)?.status).toBe("in-progress");
  });

  it("assignTask sets role and agentId", async () => {
    const repoRoot = await makeRepoRoot();
    const board = makeBoard(repoRoot);

    const task = createTask(board, { title: "Assign me" });
    assignTask(board, task.id, "developer", "codeclaw-developer");

    const updated = getTaskById(board, task.id);
    expect(updated?.assignedRole).toBe("developer");
    expect(updated?.agentId).toBe("codeclaw-developer");
  });

  it("addBlocker moves to blocked and removeBlocker restores to backlog", async () => {
    const repoRoot = await makeRepoRoot();
    const board = makeBoard(repoRoot);

    const task = createTask(board, { title: "Handle blocker" });
    moveTask(board, task.id, "in-progress");

    addBlocker(board, task.id, "Waiting on API key");
    expect(getTaskById(board, task.id)?.status).toBe("blocked");
    expect(getTaskById(board, task.id)?.blockers).toEqual(["Waiting on API key"]);

    removeBlocker(board, task.id, 0);
    expect(getTaskById(board, task.id)?.blockers).toEqual([]);
    expect(getTaskById(board, task.id)?.status).toBe("backlog");
  });

  it("getTasksByStatus filters correctly", async () => {
    const repoRoot = await makeRepoRoot();
    const board = makeBoard(repoRoot);

    const backlogTask = createTask(board, { title: "Backlog task" });
    const inProgressTask = createTask(board, { title: "In progress task" });

    moveTask(board, inProgressTask.id, "in-progress");

    const backlog = getTasksByStatus(board, "backlog");
    const inProgress = getTasksByStatus(board, "in-progress");

    expect(backlog.map((task) => task.id)).toEqual([backlogTask.id]);
    expect(inProgress.map((task) => task.id)).toEqual([inProgressTask.id]);
  });

  it("formatBoardMarkdown renders all sections", async () => {
    const repoRoot = await makeRepoRoot();
    const board = makeBoard(repoRoot);

    createTask(board, { title: "Backlog" });
    const t2 = createTask(board, { title: "Progress", assignedRole: "developer" });
    const t3 = createTask(board, { title: "Review", assignedRole: "reviewer" });
    const t4 = createTask(board, { title: "Done task" });
    const t5 = createTask(board, { title: "Blocked task" });

    assignTask(board, t2.id, "developer", "codeclaw-developer");
    assignTask(board, t3.id, "reviewer", "codeclaw-reviewer");
    moveTask(board, t2.id, "in-progress");
    moveTask(board, t3.id, "in-review");
    moveTask(board, t4.id, "done");
    addBlocker(board, t5.id, "Dependency missing");

    const markdown = formatBoardMarkdown(board);

    expect(markdown).toContain("## Backlog");
    expect(markdown).toContain("## In Progress");
    expect(markdown).toContain("## In Review");
    expect(markdown).toContain("## Done");
    expect(markdown).toContain("## Blocked");
    expect(markdown).toContain("- [x] #4 — Done task");
    expect(markdown).toContain("- [ ] #1 — Backlog");
    expect(markdown).toContain("| developer | codeclaw-developer |");
    expect(markdown).toContain("| reviewer | codeclaw-reviewer |");
    expect(markdown).toContain("| — | — |");
    expect(markdown).toContain(`#${t5.id} — Blocked task`);

    const boardMdPath = path.join(repoRoot, ".codeclaw", "board.md");
    await writeBoard(board);
    const persistedMarkdown = await readFile(boardMdPath, "utf8");
    expect(persistedMarkdown).toBe(markdown);
  });

  it("readBoard and writeBoard round-trip", async () => {
    const repoRoot = await makeRepoRoot();
    const board = await initBoard(repoRoot, "CodeClaw");

    const task = createTask(board, {
      title: "Round trip",
      assignedRole: "business-analyst",
      acceptanceCriteria: ["state persists"],
      constraints: ["no extra fields"],
      notes: "Track state",
    });
    assignTask(board, task.id, "business-analyst", "codeclaw-business-analyst");
    moveTask(board, task.id, "in-progress");

    await writeBoard(board);
    const loaded = await readBoard(repoRoot);

    expect(loaded).toEqual(board);
  });
});
