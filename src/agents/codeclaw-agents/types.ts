import path from "node:path";
import { CODECLAW_ROLES, type CodeClawRole } from "../codeclaw-roles/types.js";

export interface CodeClawAgentConfig {
  agentId: string;
  role: CodeClawRole;
  displayName: string;
  defaultModel?: string;
  agentDir: string;
  toolPolicy?: "allowlist" | "denylist";
  allowedTools?: string[];
}

const ROLE_ORDER: CodeClawRole[] = [
  "team-lead",
  "project-manager",
  "business-analyst",
  "developer",
  "tester",
  "reviewer",
];

export function getCodeClawAgentId(role: CodeClawRole): string {
  return `codeclaw-${role}`;
}

export function getDefaultCodeClawAgentConfigs(baseDir: string): CodeClawAgentConfig[] {
  return ROLE_ORDER.map((role) => ({
    agentId: getCodeClawAgentId(role),
    role,
    displayName: `CodeClaw ${CODECLAW_ROLES[role].displayName}`,
    agentDir: path.join(baseDir, role),
  }));
}
