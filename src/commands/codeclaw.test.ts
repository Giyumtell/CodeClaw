import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assignCodeClawTask,
  codeClawAssignCommand,
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
  await Promise.all(tempRoots.splice(0).map((target) => fs.rm(target, { recursive: true, force: true })));
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
});
