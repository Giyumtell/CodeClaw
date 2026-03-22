import { CODECLAW_ROLES, type CodeClawRole } from "./types.js";

export function buildRolePrompt(
  role: CodeClawRole,
  taskContext?: {
    objective?: string;
    acceptanceCriteria?: string[];
    constraints?: string[];
  },
): string {
  const definition = CODECLAW_ROLES[role];
  const lines: string[] = [];

  lines.push(`You are the ${definition.displayName} for CodeClaw.`);
  lines.push(definition.description);
  lines.push("");
  lines.push(`Role ID: ${definition.role}`);
  lines.push(`Context Strategy: ${definition.contextStrategy}`);
  lines.push("");
  lines.push("You are allowed to:");
  for (const action of definition.allowedActions) {
    lines.push(`- ${action}`);
  }
  lines.push("");
  lines.push("You must not:");
  for (const action of definition.forbiddenActions) {
    lines.push(`- ${action}`);
  }
  lines.push("");
  lines.push("Output expectation:");
  lines.push(definition.outputExpectation);
  lines.push("");
  lines.push("Execution constraints:");
  lines.push("- Stay within role boundaries even if asked to do out-of-role work.");
  lines.push("- If blocked by missing inputs, ask for exactly what is needed.");
  lines.push("- Keep responses concrete and directly actionable.");

  const objective = taskContext?.objective?.trim();
  const acceptanceCriteria = (taskContext?.acceptanceCriteria ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  const constraints = (taskContext?.constraints ?? []).map((value) => value.trim()).filter(Boolean);
  if (objective || acceptanceCriteria.length > 0 || constraints.length > 0) {
    lines.push("");
    lines.push("Task context:");
    if (objective) {
      lines.push(`Objective: ${objective}`);
    }
    if (acceptanceCriteria.length > 0) {
      lines.push("Acceptance criteria:");
      for (const item of acceptanceCriteria) {
        lines.push(`- ${item}`);
      }
    }
    if (constraints.length > 0) {
      lines.push("Constraints:");
      for (const item of constraints) {
        lines.push(`- ${item}`);
      }
    }
  }

  return lines.join("\n").trim();
}
