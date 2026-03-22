import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureRoleAgentDirs } from "./agent-setup.js";
import { generateRoleSoul } from "./soul-templates.js";
import { getCodeClawAgentId, getDefaultCodeClawAgentConfigs } from "./types.js";

const ROLES = [
  "team-lead",
  "project-manager",
  "business-analyst",
  "developer",
  "tester",
  "reviewer",
] as const;

const tempRoots: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = path.join(
    os.tmpdir(),
    `codeclaw-agents-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("codeclaw agents", () => {
  it("getCodeClawAgentId returns correct IDs for all roles", () => {
    for (const role of ROLES) {
      expect(getCodeClawAgentId(role)).toBe(`codeclaw-${role}`);
    }
  });

  it("getDefaultCodeClawAgentConfigs returns 6 configs", async () => {
    const baseDir = await makeTempDir();
    const configs = getDefaultCodeClawAgentConfigs(baseDir);

    expect(configs).toHaveLength(6);
    expect(configs.map((config) => config.role).toSorted()).toEqual([...ROLES].toSorted());
  });

  it("generateRoleSoul returns non-empty content for each role", () => {
    for (const role of ROLES) {
      const soul = generateRoleSoul(role);
      expect(soul.trim().length).toBeGreaterThan(0);
    }
  });

  it("soul templates encode chain of command", () => {
    expect(generateRoleSoul("team-lead")).toContain("User -> Team Lead");
    expect(generateRoleSoul("project-manager")).toContain("report to the Team Lead");
    expect(generateRoleSoul("business-analyst")).toContain("report to the PM");
    expect(generateRoleSoul("developer")).toContain("report to the PM");
    expect(generateRoleSoul("tester")).toContain("report to the PM");
    expect(generateRoleSoul("reviewer")).toContain("report directly to the Team Lead");
  });

  it("ensureRoleAgentDirs creates all directories and SOUL.md files", async () => {
    const baseDir = await makeTempDir();

    await ensureRoleAgentDirs(baseDir);

    for (const role of ROLES) {
      const roleDir = path.join(baseDir, role);
      const soulPath = path.join(roleDir, "SOUL.md");
      const memoryPath = path.join(roleDir, "MEMORY.md");

      await access(roleDir);
      await access(soulPath);
      await access(memoryPath);

      const soulText = await readFile(soulPath, "utf8");
      expect(soulText.trim().length).toBeGreaterThan(0);
    }
  });

  it("ensureRoleAgentDirs never overwrites existing files", async () => {
    const baseDir = await makeTempDir();
    const roleDir = path.join(baseDir, "developer");
    await mkdir(roleDir, { recursive: true });

    const soulPath = path.join(roleDir, "SOUL.md");
    const memoryPath = path.join(roleDir, "MEMORY.md");
    await writeFile(soulPath, "custom soul", "utf8");
    await writeFile(memoryPath, "custom memory", "utf8");

    await ensureRoleAgentDirs(baseDir);

    expect(await readFile(soulPath, "utf8")).toBe("custom soul");
    expect(await readFile(memoryPath, "utf8")).toBe("custom memory");
  });
});
