export type OrchestratorPhase =
  | "requirements"
  | "planning"
  | "development"
  | "testing"
  | "review"
  | "rework"
  | "done";

export interface OrchestratorState {
  projectName: string;
  repoRoot: string;
  currentPhase: OrchestratorPhase;
  userGoal: string;
  architectureNotes?: string;
  phaseHistory: Array<{
    phase: OrchestratorPhase;
    startedAt: string;
    completedAt?: string;
    notes?: string;
  }>;
}
