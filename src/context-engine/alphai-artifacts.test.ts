import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverAlphaIotaArtifacts, hasAlphaIotaArtifacts } from "./alphai-artifacts.js";

const tempRoots: string[] = [];

async function makeRepo(): Promise<string> {
  const repoRoot = path.join(
    os.tmpdir(),
    `codeclaw-alphai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(repoRoot, {
    recursive: true,
  });
  tempRoots.push(repoRoot);
  return repoRoot;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("discoverAlphaIotaArtifacts", () => {
  it("returns null when .alphai/context.txt is missing", async () => {
    const repoRoot = await makeRepo();

    await expect(discoverAlphaIotaArtifacts(repoRoot)).resolves.toBeNull();
    await expect(hasAlphaIotaArtifacts(repoRoot)).resolves.toBe(false);
  });

  it("discovers context file and optional db/config files", async () => {
    const repoRoot = await makeRepo();
    const alphaiDir = path.join(repoRoot, ".alphai");
    await mkdir(alphaiDir, { recursive: true });
    await writeFile(path.join(alphaiDir, "context.txt"), "repo summary");
    await writeFile(path.join(alphaiDir, "alphai.db"), "sqlite");
    await writeFile(path.join(alphaiDir, "config.yaml"), "provider: copilot\n");

    await expect(discoverAlphaIotaArtifacts(repoRoot)).resolves.toEqual({
      repoRoot,
      alphaiDir,
      contextFile: path.join(alphaiDir, "context.txt"),
      dbFile: path.join(alphaiDir, "alphai.db"),
      configFile: path.join(alphaiDir, "config.yaml"),
    });
    await expect(hasAlphaIotaArtifacts(repoRoot)).resolves.toBe(true);
  });

  it("supports legacy tree.db naming when present", async () => {
    const repoRoot = await makeRepo();
    const alphaiDir = path.join(repoRoot, ".alphai");
    await mkdir(alphaiDir, { recursive: true });
    await writeFile(path.join(alphaiDir, "context.txt"), "repo summary");
    await writeFile(path.join(alphaiDir, "tree.db"), "sqlite");

    await expect(discoverAlphaIotaArtifacts(repoRoot)).resolves.toEqual({
      repoRoot,
      alphaiDir,
      contextFile: path.join(alphaiDir, "context.txt"),
      dbFile: path.join(alphaiDir, "tree.db"),
    });
  });
});
