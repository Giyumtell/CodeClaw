import path from "node:path";
import { discoverAlphaIotaArtifacts } from "../context-engine/alphai-artifacts.js";
import {
  selectAlphaIotaContextSlice,
  selectAlphaIotaContextByStrategy,
} from "../context-engine/alphai-context-slice.js";
import {
  buildRolePrompt,
  CODECLAW_ROLES,
  type CodeClawContextStrategy,
  type CodeClawRole,
} from "./codeclaw-roles/index.js";

export type CodeClawTaskPacket = {
  title?: string;
  objective: string;
  repoRoot: string;
  repoName: string;
  workspaceName?: string;
  role?: CodeClawRole;
  rolePrompt?: string;
  contextStrategy?: CodeClawContextStrategy;
  acceptanceCriteria: string[];
  constraints: string[];
  alphaIota:
    | {
        available: false;
      }
    | {
        available: true;
        contextFile: string;
        matchedPaths: string[];
        excerpt: string;
      };
};

export async function buildCodeClawTaskPacket(params: {
  objective: string;
  repoRoot: string;
  title?: string;
  workspaceName?: string;
  role?: CodeClawRole;
  acceptanceCriteria?: string[];
  constraints?: string[];
  maxContextChars?: number;
}): Promise<CodeClawTaskPacket> {
  const objective = params.objective.trim();
  const repoRoot = params.repoRoot;
  const repoName = path.basename(repoRoot);
  const acceptanceCriteria = (params.acceptanceCriteria ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  const constraints = (params.constraints ?? []).map((value) => value.trim()).filter(Boolean);
  const role = params.role;
  const roleDefinition = role ? CODECLAW_ROLES[role] : undefined;
  const rolePrompt = role
    ? buildRolePrompt(role, {
        objective,
        acceptanceCriteria,
        constraints,
      })
    : undefined;
  const contextStrategy = roleDefinition?.contextStrategy;

  const artifacts = await discoverAlphaIotaArtifacts(repoRoot);
  if (!artifacts) {
    return {
      title: params.title?.trim() || undefined,
      objective,
      repoRoot,
      repoName,
      workspaceName: params.workspaceName?.trim() || undefined,
      role,
      rolePrompt,
      contextStrategy,
      acceptanceCriteria,
      constraints,
      alphaIota: {
        available: false,
      },
    };
  }

  const slice =
    contextStrategy && role
      ? await selectAlphaIotaContextByStrategy({
          repoRoot,
          prompt: objective,
          strategy: contextStrategy,
          maxChars: params.maxContextChars,
        })
      : await selectAlphaIotaContextSlice({
          repoRoot,
          prompt: objective,
          maxChars: params.maxContextChars,
        });

  return {
    title: params.title?.trim() || undefined,
    objective,
    repoRoot,
    repoName,
    workspaceName: params.workspaceName?.trim() || undefined,
    role,
    rolePrompt,
    contextStrategy,
    acceptanceCriteria,
    constraints,
    alphaIota: slice
      ? {
          available: true,
          contextFile: slice.contextFile,
          matchedPaths: slice.matchedPaths,
          excerpt: slice.excerpt,
        }
      : {
          available: false,
        },
  };
}

export function formatCodeClawTaskPacket(packet: CodeClawTaskPacket): string {
  const lines: string[] = [];
  lines.push("# CodeClaw Task Packet");
  if (packet.title) {
    lines.push(`Title: ${packet.title}`);
  }
  lines.push(`Repo: ${packet.repoName}`);
  lines.push(`Repo Root: ${packet.repoRoot}`);
  if (packet.workspaceName) {
    lines.push(`Workspace: ${packet.workspaceName}`);
  }
  lines.push("");
  lines.push("## Objective");
  lines.push(packet.objective);

  if (packet.rolePrompt) {
    lines.push("");
    lines.push("## Role");
    lines.push(`Role: ${packet.role}`);
    if (packet.contextStrategy) {
      lines.push(`Context Strategy: ${packet.contextStrategy}`);
    }
    lines.push("");
    lines.push(packet.rolePrompt);
  }

  if (packet.acceptanceCriteria.length > 0) {
    lines.push("");
    lines.push("## Acceptance Criteria");
    for (const item of packet.acceptanceCriteria) {
      lines.push(`- ${item}`);
    }
  }

  if (packet.constraints.length > 0) {
    lines.push("");
    lines.push("## Constraints");
    for (const item of packet.constraints) {
      lines.push(`- ${item}`);
    }
  }

  lines.push("");
  lines.push("## Repo Context");
  if (!packet.alphaIota.available) {
    lines.push("AlphaIota: unavailable");
  } else {
    lines.push(`AlphaIota Context File: ${packet.alphaIota.contextFile}`);
    lines.push("");
    lines.push("Likely Relevant Paths:");
    if (packet.alphaIota.matchedPaths.length === 0) {
      lines.push("- no strong path matches");
    } else {
      for (const item of packet.alphaIota.matchedPaths) {
        lines.push(`- ${item}`);
      }
    }
    lines.push("");
    lines.push("Relevant AlphaIota Excerpt:");
    lines.push(packet.alphaIota.excerpt);
  }

  lines.push("");
  lines.push("## Execution Notes");
  lines.push(
    "- Use AlphaIota context as a navigation aid, not as a substitute for reading source files before editing.",
  );
  lines.push("- Verify the real code paths before making changes.");
  lines.push("- Prefer focused edits and report what changed and how it was verified.");

  return lines.join("\n").trim();
}
