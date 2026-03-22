import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readBoard } from "../../agents/codeclaw-board/board-io.js";
import { codeclawHandlers } from "./codeclaw.js";

const tempRoots: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const root = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await fs.mkdir(root, { recursive: true });
  tempRoots.push(root);
  return root;
}

async function invoke(
  method: keyof typeof codeclawHandlers,
  params: Record<string, unknown>,
): Promise<ReturnType<typeof vi.fn>> {
  const respond = vi.fn();
  await codeclawHandlers[method]({
    req: { type: "req", id: "req-1", method },
    params,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("codeclaw gateway handlers", () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await makeTempDir("codeclaw-home");
    vi.stubEnv("HOME", homeDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(
      tempRoots.splice(0).map((target) => fs.rm(target, { recursive: true, force: true })),
    );
  });

  it("codeclaw.init initializes board artifacts", async () => {
    const repoRoot = await makeTempDir("codeclaw-repo");
    const respond = await invoke("codeclaw.init", {
      repoRoot,
      projectName: "Gateway Project",
    });

    const call = respond.mock.calls[0] as [boolean, { boardPath: string } | undefined];
    expect(call[0]).toBe(true);
    expect(call[1]?.boardPath).toContain(path.join(repoRoot, ".codeclaw", "board.md"));
    expect(await readBoard(repoRoot)).not.toBeNull();
  });

  it("codeclaw.board returns board state", async () => {
    const repoRoot = await makeTempDir("codeclaw-repo");
    await invoke("codeclaw.init", { repoRoot, projectName: "Gateway Project" });

    const respond = await invoke("codeclaw.board", { repoRoot });

    const call = respond.mock.calls[0] as [boolean, { projectName: string } | undefined];
    expect(call[0]).toBe(true);
    expect(call[1]?.projectName).toBe("Gateway Project");
  });

  it("codeclaw.plan creates a 6-step plan", async () => {
    const repoRoot = await makeTempDir("codeclaw-repo");
    await invoke("codeclaw.init", { repoRoot, projectName: "Gateway Project" });

    const respond = await invoke("codeclaw.plan", {
      repoRoot,
      projectName: "Gateway Project",
      userGoal: "Ship gateway handlers",
    });

    const call = respond.mock.calls[0] as [boolean, Array<unknown> | undefined];
    expect(call[0]).toBe(true);
    expect(call[1]).toHaveLength(6);
  });

  it("codeclaw.next returns next step", async () => {
    const repoRoot = await makeTempDir("codeclaw-repo");
    await invoke("codeclaw.plan", {
      repoRoot,
      projectName: "Gateway Project",
      userGoal: "Ship gateway handlers",
    });

    const respond = await invoke("codeclaw.next", { repoRoot });

    const call = respond.mock.calls[0] as [
      boolean,
      { done?: boolean; taskId?: number } | undefined,
    ];
    expect(call[0]).toBe(true);
    expect(call[1]?.done).not.toBe(true);
    expect(call[1]?.taskId).toBeTypeOf("number");
  });

  it("codeclaw.advance moves task status", async () => {
    const repoRoot = await makeTempDir("codeclaw-repo");
    await invoke("codeclaw.plan", {
      repoRoot,
      projectName: "Gateway Project",
      userGoal: "Ship gateway handlers",
    });

    const respond = await invoke("codeclaw.advance", {
      repoRoot,
      taskId: 1,
      newStatus: "in-progress",
    });

    const call = respond.mock.calls[0] as [
      boolean,
      { tasks: Array<{ id: number; status: string }> } | undefined,
    ];
    expect(call[0]).toBe(true);
    expect(call[1]?.tasks.find((task) => task.id === 1)?.status).toBe("in-progress");
  });

  it("codeclaw.execute returns spawn params for next step", async () => {
    const repoRoot = await makeTempDir("codeclaw-repo");
    const agentBaseDir = await makeTempDir("codeclaw-agents");
    await invoke("codeclaw.plan", {
      repoRoot,
      projectName: "Gateway Project",
      userGoal: "Ship gateway handlers",
      agentBaseDir,
    });

    const respond = await invoke("codeclaw.execute", { repoRoot, agentBaseDir });

    const call = respond.mock.calls[0] as [
      boolean,
      { done?: boolean; step?: { taskId: number }; spawnParams?: { agentId: string } } | undefined,
    ];
    expect(call[0]).toBe(true);
    expect(call[1]?.done).not.toBe(true);
    expect(call[1]?.step?.taskId).toBeTypeOf("number");
    expect(call[1]?.spawnParams?.agentId).toBeTypeOf("string");
  });
});
