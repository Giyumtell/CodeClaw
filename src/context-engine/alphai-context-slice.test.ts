import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { selectAlphaIotaContextSlice } from "./alphai-context-slice.js";

const tempRoots: string[] = [];

async function makeRepoWithContext(contextText: string): Promise<string> {
  const repoRoot = path.join(
    os.tmpdir(),
    `codeclaw-alphai-slice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(path.join(repoRoot, ".alphai"), { recursive: true });
  await writeFile(path.join(repoRoot, ".alphai", "context.txt"), contextText);
  tempRoots.push(repoRoot);
  return repoRoot;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("selectAlphaIotaContextSlice", () => {
  it("returns null when AlphaIota artifacts are missing", async () => {
    const repoRoot = path.join(
      os.tmpdir(),
      `codeclaw-alphai-missing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    tempRoots.push(repoRoot);

    await expect(
      selectAlphaIotaContextSlice({
        repoRoot,
        prompt: "add context engine tests",
      }),
    ).resolves.toBeNull();
  });

  it("extracts relevant paths and a focused excerpt from context.txt", async () => {
    const repoRoot = await makeRepoWithContext(`# DemoRepo — DemoRepo

src/
  context-engine/
    src/context-engine/index.ts — index.ts
      registerContextEngine(id: string)
    src/context-engine/legacy.ts — legacy.ts
      LegacyContextEngine [class] — LegacyContextEngine
  agents/
    src/agents/subagent-spawn.ts — subagent-spawn.ts
      spawnSubagentDirect(params)
`);

    const result = await selectAlphaIotaContextSlice({
      repoRoot,
      prompt: "add tests for context engine legacy assemble",
      maxChars: 2000,
    });

    expect(result).not.toBeNull();
    expect(result?.matchedPaths).toContain("src/context-engine/index.ts");
    expect(result?.matchedPaths).toContain("src/context-engine/legacy.ts");
    expect(result?.excerpt).toContain("LegacyContextEngine");
    expect(result?.systemPromptAddition).toContain("Likely relevant paths:");
  });

  it("truncates oversized excerpts to the requested max size", async () => {
    const repeated = Array.from({ length: 120 }, (_, index) => `    src/context-engine/file-${index}.ts — file-${index}.ts\n      context engine helper ${index}`).join("\n");
    const repoRoot = await makeRepoWithContext(`# DemoRepo — DemoRepo\n\nsrc/\n  context-engine/\n${repeated}\n`);

    const result = await selectAlphaIotaContextSlice({
      repoRoot,
      prompt: "context engine helper",
      maxChars: 500,
    });

    expect(result).not.toBeNull();
    expect(result!.excerpt.length).toBeLessThanOrEqual(500);
  });
});
