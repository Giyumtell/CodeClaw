import type { CodeClawRole } from "../codeclaw-roles/types.js";

export interface RoleMemoryEntry {
  timestamp: string;
  action: string;
  details?: string;
  taskId?: number;
}

export interface RoleMemoryState {
  role: CodeClawRole;
  lastUpdated: string;
  currentFocus?: string;
  activeTaskIds: number[];
  blockers: string[];
  recentActions: RoleMemoryEntry[];
  notes: string[];
  waitingOn?: {
    role: CodeClawRole;
    reason: string;
  };
}
