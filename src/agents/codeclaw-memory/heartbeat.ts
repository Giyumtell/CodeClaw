import { readBoard } from "../codeclaw-board/board-io.js";
import { readOrchestratorState } from "../codeclaw-orchestrator/orchestrator-io.js";
import { CODECLAW_ROLES, type CodeClawRole } from "../codeclaw-roles/types.js";
import { formatRoleMemoryMarkdown, readRoleMemory } from "./memory-io.js";

function nowIso(): string {
  return new Date().toISOString();
}

function formatRoleTaskList(params: {
  role: CodeClawRole;
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    blockers: string[];
  }>;
}): string {
  if (params.tasks.length === 0) {
    return `No tasks currently assigned to ${CODECLAW_ROLES[params.role].displayName}.`;
  }

  return params.tasks
    .toSorted((a, b) => a.id - b.id)
    .map((task) => {
      const blockerSuffix =
        task.blockers.length > 0 ? ` | blockers: ${task.blockers.join("; ")}` : "";
      return `- #${task.id} [${task.status}] ${task.title}${blockerSuffix}`;
    })
    .join("\n");
}

function formatBoardSummary(params: {
  role: CodeClawRole;
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    assignedRole?: CodeClawRole;
    blockers: string[];
  }>;
}): string {
  if (params.tasks.length === 0) {
    return "Board is empty.";
  }

  const assignedToRole = params.tasks.filter((task) => task.assignedRole === params.role);
  const blocked = params.tasks.filter((task) => task.status === "blocked");

  const lines: string[] = [
    `- Total tasks: ${params.tasks.length}`,
    `- Assigned to you: ${assignedToRole.length}`,
    `- Blocked tasks: ${blocked.length}`,
  ];

  if (blocked.length > 0) {
    lines.push("- Blocked details:");
    for (const task of blocked.toSorted((a, b) => a.id - b.id)) {
      const blockerText =
        task.blockers.length > 0 ? task.blockers.join("; ") : "No blocker details";
      lines.push(`  - #${task.id} ${task.title}: ${blockerText}`);
    }
  }

  return lines.join("\n");
}

export async function buildRoleHeartbeat(params: {
  agentDir: string;
  role: CodeClawRole;
  repoRoot: string;
}): Promise<string> {
  const [memoryState, board, orchestratorState] = await Promise.all([
    readRoleMemory(params.agentDir, params.role),
    readBoard(params.repoRoot),
    readOrchestratorState(params.repoRoot),
  ]);

  const allTasks = board?.tasks ?? [];
  const roleTasks = allTasks
    .filter((task) => task.assignedRole === params.role)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      blockers: task.blockers,
    }));

  const boardSummary = formatBoardSummary({
    role: params.role,
    tasks: allTasks,
  });

  const memorySummary = memoryState
    ? formatRoleMemoryMarkdown(memoryState).trimEnd()
    : "No memory found - this is your first session";

  const phase = orchestratorState?.currentPhase ?? "unknown";

  return [
    `## Heartbeat Check — ${CODECLAW_ROLES[params.role].displayName} — ${nowIso()}`,
    "",
    "### Your Memory State:",
    memorySummary,
    "",
    "### Board State:",
    boardSummary,
    "",
    `### Orchestrator Phase: ${phase}`,
    "",
    "### Your Tasks:",
    formatRoleTaskList({ role: params.role, tasks: roleTasks }),
    "",
    "### Action Required:",
    "Review the above. Update your memory. Take action on any pending tasks.",
    "If nothing needs attention, update memory with a heartbeat note and reply HEARTBEAT_OK.",
  ].join("\n");
}
