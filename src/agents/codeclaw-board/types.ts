import type { CodeClawRole } from "../codeclaw-roles/types.js";

export type CodeClawTaskStatus = "backlog" | "in-progress" | "in-review" | "done" | "blocked";

export interface CodeClawBoardTask {
  id: number;
  title: string;
  status: CodeClawTaskStatus;
  assignedRole?: CodeClawRole;
  agentId?: string;
  acceptanceCriteria: string[];
  constraints: string[];
  blockers: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeClawBoard {
  projectName: string;
  repoRoot: string;
  tasks: CodeClawBoardTask[];
  nextTaskId: number;
}
