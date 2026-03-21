import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCodeClawTaskPacket, formatCodeClawTaskPacket } from "./codeclaw-task-packet.js";

const tempRoots: string[] = [];

async function makeRepoWithContext(contextText?: string): Promise<string> {
  const repoRoot = path.join(
    os.tmpdir(),
    `codeclaw-task-packet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(repoRoot, { recursive: true });
  if (contextText) {
    await mkdir(path.join(repoRoot, ".alphai"), { recursive: true });
    await writeFile(path.join(repoRoot, ".alphai", "context.txt"), contextText);
  }
  tempRoots.push(repoRoot);
  return repoRoot;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((target) => rm(target, { recursive: true, force: true })));
});

describe("buildCodeClawTaskPacket", () => {
  it("builds a packet without AlphaIota when no artifacts exist", async () => {
    const repoRoot = await makeRepoWithContext();
    const packet = await buildCodeClawTaskPacket({
      objective: "Add a project status command",
      repoRoot,
      acceptanceCriteria: ["command exists", "prints active task"],
    });

    expect(packet.repoRoot).toBe(repoRoot);
    expect(packet.alphaIota.available).toBe(false);
    expect(packet.acceptanceCriteria).toEqual(["command exists", "prints active task"]);
  });

  it("includes AlphaIota excerpt and matched paths when available", async () => {
    const repoRoot = await makeRepoWithContext(`# DemoRepo — DemoRepo\n\nsrc/\n  agents/\n    src/agents/codeclaw-task-packet.ts — codeclaw-task-packet.ts\n      buildCodeClawTaskPacket(params)\n  context-engine/\n    src/context-engine/legacy.ts — legacy.ts\n      LegacyContextEngine [class] — LegacyContextEngine\n`);

    const packet = await buildCodeClawTaskPacket({
      objective: "improve codeclaw task packet builder",
      repoRoot,
      title: "Task packet upgrade",
      constraints: ["keep it small"],
    });

    expect(packet.alphaIota.available).toBe(true);
    if (packet.alphaIota.available) {
      expect(packet.alphaIota.matchedPaths).toContain("src/agents/codeclaw-task-packet.ts");
      expect(packet.alphaIota.excerpt).toContain("buildCodeClawTaskPacket");
    }
  });

  it("formats a readable task packet", async () => {
    const repoRoot = await makeRepoWithContext(`# DemoRepo — DemoRepo\n\nsrc/\n  context-engine/\n    src/context-engine/legacy.ts — legacy.ts\n      LegacyContextEngine [class] — LegacyContextEngine\n`);

    const packet = await buildCodeClawTaskPacket({
      objective: "update legacy context behavior",
      repoRoot,
      title: "Legacy context tweak",
      acceptanceCriteria: ["keeps tests passing"],
      constraints: ["do not widen scope"],
    });

    const text = formatCodeClawTaskPacket(packet);
    expect(text).toContain("# CodeClaw Task Packet");
    expect(text).toContain("## Objective");
    expect(text).toContain("## Acceptance Criteria");
    expect(text).toContain("## Repo Context");
  });
});
