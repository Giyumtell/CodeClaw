import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { selectAlphaIotaContextByStrategy } from "./alphai-context-slice.js";

const tempRoots: string[] = [];

async function makeRepoWithContext(contextText: string): Promise<string> {
  const repoRoot = path.join(
    os.tmpdir(),
    `codeclaw-alphai-strategy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe("selectAlphaIotaContextByStrategy", () => {
  it("returns full context for full strategy", async () => {
    const repoRoot = await makeRepoWithContext(
      `# DemoRepo — DemoRepo\n\nsrc/\n  agents/\n    src/agents/a.ts — a.ts\n`,
    );

    const result = await selectAlphaIotaContextByStrategy({
      repoRoot,
      prompt: "anything",
      strategy: "full",
      maxChars: 2000,
    });

    expect(result).not.toBeNull();
    expect(result?.excerpt).toContain("# DemoRepo");
    expect(result?.excerpt).toContain("src/agents/a.ts");
  });

  it("returns summary context capped to roughly first 80 lines", async () => {
    const lines = Array.from({ length: 140 }, (_, i) => `line-${i + 1}`);
    const repoRoot = await makeRepoWithContext(lines.join("\n"));

    const result = await selectAlphaIotaContextByStrategy({
      repoRoot,
      prompt: "summary",
      strategy: "summary",
      maxChars: 2000,
    });

    expect(result).not.toBeNull();
    expect(result?.excerpt).toContain("line-80");
    expect(result?.excerpt).not.toContain("line-120");
  });

  it("delegates scoped strategy to keyword-based matching behavior", async () => {
    const repoRoot = await makeRepoWithContext(`# DemoRepo — DemoRepo

src/
  context-engine/
    src/context-engine/legacy.ts — legacy.ts
      LegacyContextEngine [class] — LegacyContextEngine
  agents/
    src/agents/subagent-spawn.ts — subagent-spawn.ts
      spawnSubagentDirect(params)
`);

    const result = await selectAlphaIotaContextByStrategy({
      repoRoot,
      prompt: "legacy context engine",
      strategy: "scoped",
      maxChars: 2000,
    });

    expect(result).not.toBeNull();
    expect(result?.matchedPaths).toContain("src/context-engine/legacy.ts");
    expect(result?.excerpt).toContain("LegacyContextEngine");
  });

  it("returns null for state-only strategy", async () => {
    const repoRoot = await makeRepoWithContext("line-1\nline-2\nline-3");

    await expect(
      selectAlphaIotaContextByStrategy({
        repoRoot,
        prompt: "status update",
        strategy: "state-only",
      }),
    ).resolves.toBeNull();
  });
});
