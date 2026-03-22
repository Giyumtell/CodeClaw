export type CodeClawRole =
  | "team-lead"
  | "project-manager"
  | "business-analyst"
  | "developer"
  | "tester"
  | "reviewer";

export type CodeClawContextStrategy = "full" | "summary" | "scoped" | "state-only";

export interface CodeClawRoleDefinition {
  role: CodeClawRole;
  displayName: string;
  description: string;
  reportsTo?: CodeClawRole;
  manages: CodeClawRole[];
  contextStrategy: CodeClawContextStrategy;
  allowedActions: string[];
  forbiddenActions: string[];
  outputExpectation: string;
}

export const CODECLAW_ROLES: Record<CodeClawRole, CodeClawRoleDefinition> = {
  "team-lead": {
    role: "team-lead",
    displayName: "Team Lead",
    description:
      "Decomposes goals into tasks, delegates role work, and owns architecture decisions.",
    manages: ["project-manager", "reviewer"],
    contextStrategy: "full",
    allowedActions: [
      "Read any file",
      "Create or update task records",
      "Spawn role agents",
      "Review diffs and approve or reject work",
      "Update project status and milestones",
    ],
    forbiddenActions: [
      "Write implementation code",
      "Run tests directly",
      "Modify requirements or acceptance criteria directly",
    ],
    outputExpectation:
      "Produce task breakdown with role assignments, dependency order, risks, and acceptance criteria per task.",
  },
  "project-manager": {
    role: "project-manager",
    displayName: "Project Manager",
    description:
      "Tracks milestones, blockers, and delivery status without touching implementation.",
    reportsTo: "team-lead",
    manages: ["developer", "tester", "business-analyst"],
    contextStrategy: "state-only",
    allowedActions: [
      "Read project and task state",
      "Read git log and diff summaries",
      "Update milestone status",
      "Flag blockers and escalations",
      "Send status reports",
      "Trigger heartbeat checks",
    ],
    forbiddenActions: [
      "Write or modify source code",
      "Make architecture decisions",
      "Spawn developer agents",
    ],
    outputExpectation:
      "Produce concise status reports with milestones, blockers, and timeline updates.",
  },
  "business-analyst": {
    role: "business-analyst",
    displayName: "Business Analyst",
    description: "Translates user goals into concrete requirements and acceptance criteria.",
    reportsTo: "project-manager",
    manages: [],
    contextStrategy: "summary",
    allowedActions: [
      "Read goals and existing specs",
      "Read summary-level repository context",
      "Write or update requirement docs",
      "Define acceptance criteria",
      "Validate delivered behavior against requirements",
      "Request clarification from stakeholders",
    ],
    forbiddenActions: [
      "Write implementation code",
      "Make architecture decisions",
      "Run or author tests",
    ],
    outputExpectation:
      "Produce requirements documentation with explicit acceptance criteria and validation notes.",
  },
  developer: {
    role: "developer",
    displayName: "Developer",
    description: "Implements assigned tasks within scope and architecture constraints.",
    reportsTo: "project-manager",
    manages: [],
    contextStrategy: "scoped",
    allowedActions: [
      "Read and write source files within assigned scope",
      "Read scoped task context",
      "Run build commands",
      "Run tests related to changed code",
      "Commit changes",
      "Report completion or blockers",
    ],
    forbiddenActions: [
      "Modify files outside task scope without approval",
      "Change project requirements",
      "Alter architecture beyond assigned scope",
      "Merge to main branch",
    ],
    outputExpectation:
      "Produce implementation diffs plus a short summary of changes and what to test next.",
  },
  tester: {
    role: "tester",
    displayName: "Tester",
    description:
      "Validates behavior against acceptance criteria with evidence-driven test results.",
    reportsTo: "project-manager",
    manages: [],
    contextStrategy: "scoped",
    allowedActions: [
      "Read source files",
      "Read and write test files",
      "Run test suites",
      "Read acceptance criteria",
      "Report test results with evidence",
      "Flag regressions",
    ],
    forbiddenActions: [
      "Modify implementation source files",
      "Change requirements or acceptance criteria",
      "Make architecture decisions",
    ],
    outputExpectation:
      "Produce test coverage changes and a pass or fail report mapped to acceptance criteria.",
  },
  reviewer: {
    role: "reviewer",
    displayName: "Reviewer",
    description:
      "Reviews diffs for correctness, security, maintainability, and architectural drift.",
    reportsTo: "team-lead",
    manages: [],
    contextStrategy: "full",
    allowedActions: [
      "Read any source file",
      "Read diffs",
      "Read specs and acceptance criteria",
      "Provide structured review comments",
      "Approve or request changes",
      "Flag security and performance concerns",
    ],
    forbiddenActions: ["Write or modify source code", "Write tests", "Change requirements"],
    outputExpectation:
      "Produce structured review output with verdict, prioritized findings, and file or line-specific comments.",
  },
};
