import type { CodeClawBoard, CodeClawTaskStatus } from "./types.js";

const STATUS_SECTIONS: ReadonlyArray<{ status: CodeClawTaskStatus; heading: string }> = [
  { status: "backlog", heading: "Backlog" },
  { status: "in-progress", heading: "In Progress" },
  { status: "in-review", heading: "In Review" },
  { status: "done", heading: "Done" },
  { status: "blocked", heading: "Blocked" },
];

export function formatBoardMarkdown(board: CodeClawBoard): string {
  const lines: string[] = [`# CodeClaw Board — ${board.projectName}`, ""];

  for (const { status, heading } of STATUS_SECTIONS) {
    lines.push(`## ${heading}`);

    const tasks = board.tasks
      .filter((task) => task.status === status)
      .toSorted((a, b) => a.id - b.id);

    if (tasks.length === 0) {
      lines.push("- (none)");
      lines.push("");
      continue;
    }

    for (const task of tasks) {
      const check = task.status === "done" ? "x" : " ";
      const assignedRole = task.assignedRole ?? "—";
      const agentId = task.agentId ?? "—";
      const notes = task.notes ?? "";
      lines.push(
        `- [${check}] #${task.id} — ${task.title} | ${assignedRole} | ${agentId} | ${notes}`,
      );
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
