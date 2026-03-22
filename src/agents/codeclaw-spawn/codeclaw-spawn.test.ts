import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CODECLAW_ROLES, type CodeClawRole } from "../codeclaw-roles/types.js";
import { resolveCodeClawSpawn } from "./resolve.js";

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

describe("resolveCodeClawSpawn", () => {
  it("returns the expected agentId for each role", async () => {
    const repoRoot = await makeTempDir("codeclaw-spawn-repo");
    const agentBaseDir = await makeTempDir("codeclaw-spawn-agents");

    const roles = Object.keys(CODECLAW_ROLES) as CodeClawRole[];
    for (const role of roles) {
      const result = await resolveCodeClawSpawn({
        role,
        repoRoot,
        taskTitle: `Task for ${role}`,
        taskId: 1,
        objective: "Implement orchestrator plumbing",
        acceptanceCriteria: ["All roles can be resolved"],
        agentBaseDir,
      });

      expect(result.agentId).toBe(`codeclaw-${role}`);
    }
  });

  it("includes the role prompt in systemPromptAddition", async () => {
    const repoRoot = await makeTempDir("codeclaw-spawn-repo");
    const agentBaseDir = await makeTempDir("codeclaw-spawn-agents");

    const result = await resolveCodeClawSpawn({
      role: "developer",
      repoRoot,
      taskTitle: "Implement command",
      taskId: 2,
      objective: "Ship developer workflow",
      acceptanceCriteria: ["Command works"],
      agentBaseDir,
    });

    expect(result.systemPromptAddition).toContain("You are the Developer for CodeClaw.");
  });

  it("includes taskId and title in taskDirective", async () => {
    const repoRoot = await makeTempDir("codeclaw-spawn-repo");
    const agentBaseDir = await makeTempDir("codeclaw-spawn-agents");

    const result = await resolveCodeClawSpawn({
      role: "tester",
      repoRoot,
      taskTitle: "Test and validate: feature",
      taskId: 9,
      objective: "Validate feature behavior",
      acceptanceCriteria: ["All tests pass"],
      agentBaseDir,
    });

    expect(result.taskDirective).toContain("Task ID: #9");
    expect(result.taskDirective).toContain("Task Title: Test and validate: feature");
  });

  it("sets expected contextStrategy values by role", async () => {
    const repoRoot = await makeTempDir("codeclaw-spawn-repo");
    const agentBaseDir = await makeTempDir("codeclaw-spawn-agents");

    const developer = await resolveCodeClawSpawn({
      role: "developer",
      repoRoot,
      taskTitle: "Implement",
      taskId: 3,
      objective: "Build feature",
      acceptanceCriteria: [],
      agentBaseDir,
    });

    const teamLead = await resolveCodeClawSpawn({
      role: "team-lead",
      repoRoot,
      taskTitle: "Plan",
      taskId: 4,
      objective: "Plan feature",
      acceptanceCriteria: [],
      agentBaseDir,
    });

    expect(developer.contextStrategy).toBe("scoped");
    expect(teamLead.contextStrategy).toBe("full");
  });

  it("warns when AlphaIota context is unavailable for code-facing roles", async () => {
    const repoRoot = await makeTempDir("codeclaw-spawn-repo");
    const agentBaseDir = await makeTempDir("codeclaw-spawn-agents");

    const result = await resolveCodeClawSpawn({
      role: "developer",
      repoRoot,
      taskTitle: "Build feature",
      taskId: 5,
      objective: "Implement feature X",
      acceptanceCriteria: ["Feature works"],
      agentBaseDir,
    });

    expect(result.systemPromptAddition).toContain("AlphaIota context unavailable");
    expect(result.systemPromptAddition).toContain("run `alphai`");
  });

  it("does NOT warn for state-only roles (PM) when AlphaIota is absent", async () => {
    const repoRoot = await makeTempDir("codeclaw-spawn-repo");
    const agentBaseDir = await makeTempDir("codeclaw-spawn-agents");

    const result = await resolveCodeClawSpawn({
      role: "project-manager",
      repoRoot,
      taskTitle: "Track progress",
      taskId: 6,
      objective: "Monitor sprint",
      acceptanceCriteria: [],
      agentBaseDir,
    });

    expect(result.systemPromptAddition).not.toContain("AlphaIota context unavailable");
  });

  it("injects AlphaIota context when .alphai/context.txt exists", async () => {
    const repoRoot = await makeTempDir("codeclaw-spawn-repo");
    const agentBaseDir = await makeTempDir("codeclaw-spawn-agents");

    const alphaDir = path.join(repoRoot, ".alphai");
    await mkdir(alphaDir, { recursive: true });
    await writeFile(
      path.join(alphaDir, "context.txt"),
      "# Architecture\nsrc/main.ts — Entry point\nsrc/utils.ts — Shared utilities\n",
    );

    const result = await resolveCodeClawSpawn({
      role: "developer",
      repoRoot,
      taskTitle: "Build feature",
      taskId: 7,
      objective: "Implement utilities",
      acceptanceCriteria: ["Utils work"],
      agentBaseDir,
    });

    expect(result.systemPromptAddition).toContain("AlphaIota repo context");
    expect(result.systemPromptAddition).not.toContain("AlphaIota context unavailable");
  });
});
