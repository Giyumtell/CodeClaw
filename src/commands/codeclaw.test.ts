import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assignCodeClawTask,
  codeClawAssignCommand,
  codeClawBoardCommand,
  codeClawCompleteCommand,
  codeClawExecuteCommand,
  codeClawInitCommand,
  codeClawNextCommand,
  codeClawProgressCommand,
  codeClawRunAllCommand,
  codeClawRunCommand,
  codeClawStatusCommand,
  getCodeClawStatus,
} from "./codeclaw.js";

const tempRoots: string[] = [];

async function makeStateFile(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-state-"));
  tempRoots.push(root);
  return path.join(root, "codeclaw", "projects.json");
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((target) => fs.rm(target, { recursive: true, force: true })),
  );
});

describe("assignCodeClawTask", () => {
  it("creates a project and active task", async () => {
    const stateFile = await makeStateFile();
    const result = await assignCodeClawTask({
      repoRoot: "/repo/demo",
      objective: "build assign command",
      acceptanceCriteria: ["stores active task"],
      stateFile,
    });

    expect(result.project.id).toBe("demo");
    expect(result.task.id).toBe("task-1");
    expect(result.project.activeTaskId).toBe("task-1");

    const status = await getCodeClawStatus({ stateFile });
    expect(status.projects).toHaveLength(1);
    expect(status.projects[0]?.tasks).toHaveLength(1);
  });

  it("appends tasks to an existing repo project", async () => {
    const stateFile = await makeStateFile();
    await assignCodeClawTask({
      repoRoot: "/repo/demo",
      objective: "first task",
      stateFile,
    });
    const result = await assignCodeClawTask({
      repoRoot: "/repo/demo",
      objective: "second task",
      stateFile,
    });

    expect(result.task.id).toBe("task-2");
    const status = await getCodeClawStatus({ stateFile });
    expect(status.projects[0]?.tasks).toHaveLength(2);
    expect(status.projects[0]?.activeTaskId).toBe("task-2");
  });
});

describe("CodeClaw commands", () => {
  it("prints human-readable assign output", async () => {
    const stateFile = await makeStateFile();
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawAssignCommand(
      {
        repoRoot: "/repo/demo",
        objective: "implement assign status flow",
        acceptanceCriteria: ["prints output"],
        stateFile,
      },
      runtime,
    );

    expect(runtime.log).toHaveBeenCalledWith("Assigned task-1 in demo");
    expect(runtime.log).toHaveBeenCalledWith("Acceptance Criteria:");
  });

  it("prints human-readable status output", async () => {
    const stateFile = await makeStateFile();
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
    await assignCodeClawTask({
      repoRoot: "/repo/demo",
      objective: "implement assign status flow",
      stateFile,
    });

    await codeClawStatusCommand({ stateFile }, runtime);

    expect(runtime.log).toHaveBeenCalledWith("demo — /repo/demo");
    expect(runtime.log).toHaveBeenCalledWith("  tasks: 1");
    expect(runtime.log).toHaveBeenCalledWith("  active: task-1");
  });

  it("codeClawInitCommand creates .codeclaw directory and board files", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-repo-"));
    const agentBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-agents-"));
    tempRoots.push(repoRoot, agentBaseDir);
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawInitCommand({ repoRoot, agentBaseDir }, runtime);

    await fs.access(path.join(repoRoot, ".codeclaw"));
    await fs.access(path.join(repoRoot, ".codeclaw", "board.md"));
    await fs.access(path.join(repoRoot, ".codeclaw", "board-state.json"));
  });

  it("codeClawRunCommand prints run plan with 6 steps", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-repo-"));
    const agentBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-agents-"));
    tempRoots.push(repoRoot, agentBaseDir);
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawRunCommand(
      {
        repoRoot,
        userGoal: "Build CodeClaw orchestration",
        projectName: "CodeClaw",
        agentBaseDir,
      },
      runtime,
    );

    const loggedLines = runtime.log.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.startsWith("- ["));
    expect(loggedLines).toHaveLength(6);
  });

  it("codeClawBoardCommand shows empty board after init", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-repo-"));
    const agentBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-agents-"));
    tempRoots.push(repoRoot, agentBaseDir);
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawInitCommand({ repoRoot, agentBaseDir }, runtime);
    runtime.log.mockClear();
    await codeClawBoardCommand({ repoRoot }, runtime);

    const boardOutput = runtime.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(boardOutput).toContain("# CodeClaw Board");
    expect(boardOutput).toContain("- (none)");
  });

  it("codeClawNextCommand returns next step", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-repo-"));
    const agentBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-agents-"));
    tempRoots.push(repoRoot, agentBaseDir);
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawRunCommand(
      {
        repoRoot,
        userGoal: "Build CodeClaw orchestration",
        projectName: "CodeClaw",
        agentBaseDir,
      },
      runtime,
    );
    runtime.log.mockClear();

    await codeClawNextCommand({ repoRoot, agentBaseDir }, runtime);

    const output = runtime.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Next step:");
    expect(output).toContain("business-analyst");
  });

  it("codeClawExecuteCommand prepares next spawn params", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-repo-"));
    const agentBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-agents-"));
    tempRoots.push(repoRoot, agentBaseDir);
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawRunCommand(
      {
        repoRoot,
        userGoal: "Build CodeClaw orchestration",
        projectName: "CodeClaw",
        agentBaseDir,
      },
      runtime,
    );
    runtime.log.mockClear();

    await codeClawExecuteCommand({ repoRoot, agentBaseDir }, runtime);

    const output = runtime.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Prepared [requirements] business-analyst");
    expect(output).toContain("Use --spawn to launch this step via gateway.");
  });

  it("codeClawProgressCommand shows health and progress summary", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-repo-"));
    const agentBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-agents-"));
    tempRoots.push(repoRoot, agentBaseDir);
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawRunCommand(
      {
        repoRoot,
        userGoal: "Build heartbeat checks",
        projectName: "CodeClaw",
        agentBaseDir,
      },
      runtime,
    );
    await codeClawExecuteCommand({ repoRoot, agentBaseDir }, runtime);
    runtime.log.mockClear();

    await codeClawProgressCommand({ repoRoot }, runtime);

    const output = runtime.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Health: healthy");
    expect(output).toContain("Phase:");
    expect(output).toContain("Progress:");
    expect(output).toContain("Running Agents:");
    expect(output).toContain("Board Summary:");
  });

  it("codeClawCompleteCommand marks task done", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-repo-"));
    const agentBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-agents-"));
    tempRoots.push(repoRoot, agentBaseDir);
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawRunCommand(
      {
        repoRoot,
        userGoal: "Test complete flow",
        projectName: "TestProject",
        agentBaseDir,
      },
      runtime,
    );

    await codeClawExecuteCommand({ repoRoot, agentBaseDir }, runtime);
    runtime.log.mockClear();

    await codeClawCompleteCommand(
      {
        repoRoot,
        taskId: 1,
        success: true,
      },
      runtime,
    );

    const output = runtime.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Task #1 marked as done");
  });

  it("codeClawRunAllCommand dry-run shows plan", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-repo-"));
    const agentBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclaw-agents-"));
    tempRoots.push(repoRoot, agentBaseDir);
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };

    await codeClawRunAllCommand(
      {
        repoRoot,
        userGoal: "Build full pipeline",
        projectName: "TestProject",
        agentBaseDir,
        dryRun: true,
      },
      runtime,
    );

    const output = runtime.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Planned");
    expect(output).toContain("Dry run complete");
    expect(output).toContain("business-analyst");
  });
});
