import { describe, expect, it } from "vitest";
import { buildRolePrompt } from "./prompts.js";
import { CODECLAW_ROLES, type CodeClawRole } from "./types.js";

const ROLES: CodeClawRole[] = [
  "team-lead",
  "project-manager",
  "business-analyst",
  "developer",
  "tester",
  "reviewer",
];

describe("CODECLAW_ROLES", () => {
  it("contains all role definitions", () => {
    expect(Object.keys(CODECLAW_ROLES).toSorted()).toEqual([...ROLES].toSorted());
  });
});

describe("buildRolePrompt", () => {
  it("returns non-empty prompts for each role", () => {
    for (const role of ROLES) {
      const prompt = buildRolePrompt(role);
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it("includes the role name in each prompt", () => {
    for (const role of ROLES) {
      const prompt = buildRolePrompt(role);
      expect(prompt).toContain(CODECLAW_ROLES[role].displayName);
    }
  });

  it("includes task context details when provided", () => {
    const prompt = buildRolePrompt("developer", {
      objective: "Build role packet support",
      acceptanceCriteria: ["includes role prompt", "sets context strategy"],
      constraints: ["keep changes small"],
    });

    expect(prompt).toContain("Objective: Build role packet support");
    expect(prompt).toContain("Acceptance criteria:");
    expect(prompt).toContain("- includes role prompt");
    expect(prompt).toContain("Constraints:");
    expect(prompt).toContain("- keep changes small");
  });
});
