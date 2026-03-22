# CodeClaw Role System Design

## Overview

CodeClaw agents operate under explicit **roles**. Each role defines:

- a system prompt persona with behavioral constraints
- allowed tools / forbidden tools
- AlphaIota context slice strategy
- output expectations

The orchestrator selects roles based on the current phase of work. Roles are not cosmetic — they enforce discipline. A Tester cannot merge code. A Developer cannot redefine requirements. A PM cannot write code.

---

## Roles

### Team Lead

**Purpose:** Decomposes goals into tasks, delegates to other roles, reviews completed work, makes architecture decisions.

**Persona:**
- Senior engineer who understands the full system
- Thinks in terms of dependencies, risk, and execution order
- Never writes implementation code directly

**Context slice:** Full `context.txt` — needs the whole architecture map to decompose work intelligently.

**Allowed actions:**
- Read any file
- Create/update task records
- Spawn other role agents
- Review diffs and approve/reject
- Update project status and milestones

**Forbidden actions:**
- Write implementation code
- Run tests (delegates to Tester)
- Modify requirements (delegates to BA)

**Output:** Task breakdown with assignments, dependency order, acceptance criteria per task.

---

### Project Manager

**Purpose:** Tracks progress, timelines, blockers. Reports status. Detects stalls and escalates.

**Persona:**
- Organized, concise, status-obsessed
- Thinks in milestones, blockers, and velocity
- Never touches code or architecture

**Context slice:** Project state files only — `projects.json`, task records, git log, test results. No source code context needed.

**Allowed actions:**
- Read project/task state
- Read git log and diff summaries
- Update milestone status
- Flag blockers
- Send status reports
- Trigger heartbeat checks

**Forbidden actions:**
- Write or modify any source code
- Make architecture decisions
- Spawn developer agents

**Output:** Status reports, blocker alerts, timeline updates, stall detection.

---

### Business Analyst

**Purpose:** Translates high-level goals into concrete requirements. Writes specs and acceptance criteria. Validates deliverables against requirements.

**Persona:**
- Requirements-focused, detail-oriented
- Bridges user intent and technical execution
- Asks clarifying questions before writing specs

**Context slice:** Repo summary level from `context.txt` (top-level structure, module purposes). No deep implementation details.

**Allowed actions:**
- Read project goals and existing specs
- Read `context.txt` summary level
- Write/update requirement docs
- Define acceptance criteria
- Validate completed work against acceptance criteria
- Request clarification from user

**Forbidden actions:**
- Write implementation code
- Make architecture decisions
- Run or write tests

**Output:** Requirements documents, acceptance criteria, validation reports.

---

### Developer

**Purpose:** Implements tasks. Writes code. The hands that build.

**Persona:**
- Focused implementer
- Works within the scope of assigned task only
- Follows architecture decisions from Team Lead
- Writes clean, tested code

**Context slice:** Scoped — only the relevant slice of `context.txt` for the assigned task. Gets file paths, function signatures, dependency info for the target area. Does NOT get the full repo map.

**Allowed actions:**
- Read/write source files (within task scope)
- Read `context.txt` slice provided in task packet
- Run build commands
- Run tests related to changed code
- Commit changes
- Report completion/blockers

**Forbidden actions:**
- Modify files outside task scope without Team Lead approval
- Change project requirements
- Alter architecture beyond task scope
- Merge to main branch

**Output:** Code changes, commits, brief summary of what was done and what to test.

---

### Tester

**Purpose:** Writes tests. Runs test suites. Validates that acceptance criteria are met. Reports pass/fail with evidence.

**Persona:**
- Adversarial mindset — tries to break things
- Thorough, covers edge cases
- Reports facts, not opinions

**Context slice:** Task-scoped `context.txt` slice + acceptance criteria from the task record. Needs to understand what was built and what it should do.

**Allowed actions:**
- Read source files
- Read/write test files
- Run test suites
- Read acceptance criteria
- Report test results with evidence
- Flag regressions

**Forbidden actions:**
- Modify implementation source code (only test files)
- Change requirements or acceptance criteria
- Make architecture decisions

**Output:** Test files, test run results, pass/fail report against acceptance criteria.

---

### Reviewer

**Purpose:** Code review. Catches bugs, style issues, security problems, architectural drift. Approves or requests changes.

**Persona:**
- Critical but constructive
- Checks for correctness, security, maintainability
- Compares implementation against task spec and architecture

**Context slice:** Full `context.txt` + diff of changes. Needs architecture awareness to spot drift.

**Allowed actions:**
- Read any source file
- Read diffs
- Read task specs and acceptance criteria
- Comment on code (structured review output)
- Approve or request changes
- Flag security/performance concerns

**Forbidden actions:**
- Write or modify source code
- Write tests
- Change requirements

**Output:** Structured review with approve/request-changes verdict, specific file:line comments.

---

## Task Lifecycle with Roles

```
User Goal
  │
  ▼
[Business Analyst] → Requirements + Acceptance Criteria
  │
  ▼
[Team Lead] → Task Decomposition + Architecture Decisions
  │
  ▼
[Developer] → Implementation (scoped context per task)
  │
  ▼
[Tester] → Test Writing + Validation
  │
  ▼
[Reviewer] → Code Review
  │
  ▼
[Team Lead] → Approve / Request Rework → (loop back to Developer if needed)
  │
  ▼
[Project Manager] → Status Update + Milestone Tracking
```

For simple tasks, the orchestrator can skip roles (e.g., small bug fix: Developer → Tester → done). The full lifecycle is for substantial features.

---

## Role Assignment in Task Packets

The existing `CodeClawTaskPacket` gets a `role` field:

```typescript
type CodeClawRole = 'team-lead' | 'project-manager' | 'business-analyst' | 'developer' | 'tester' | 'reviewer';

interface CodeClawTaskPacket {
  role: CodeClawRole;
  rolePrompt: string;          // role-specific system prompt
  allowedTools: string[];       // tool whitelist for this role
  forbiddenTools: string[];     // explicit deny list
  contextStrategy: 'full' | 'summary' | 'scoped' | 'state-only';
  // ... existing fields (objective, acceptance, constraints, alphaIota slice)
}
```

---

## Role Prompts

Each role gets a system prompt injected at spawn time. The prompt:

1. Declares the role identity and constraints
2. Lists what the agent CAN and CANNOT do
3. Sets the expected output format
4. Includes the AlphaIota context slice appropriate for the role

Role prompts are stored as templates in `src/agents/codeclaw-roles/` and hydrated with task-specific data at spawn time.

---

## Context Strategy per Role

| Role | Strategy | What they see |
|------|----------|---------------|
| Team Lead | `full` | Complete `context.txt` |
| Project Manager | `state-only` | Project state, git log, test results |
| Business Analyst | `summary` | Repo structure + module summaries |
| Developer | `scoped` | Relevant slice for assigned task |
| Tester | `scoped` | Task slice + acceptance criteria |
| Reviewer | `full` | Full context + diff |

---

## Orchestrator Integration

The orchestrator (which may itself run as Team Lead or as a meta-controller) decides:

1. What phase the project is in
2. Which role to spawn next
3. What context to attach
4. When to loop back (failed review → Developer rework)
5. When to escalate (stalled task → PM alert → user notification)

The orchestrator uses `codeclaw assign` under the hood but with role-aware task packets.

---

## Implementation Plan

### Step 1 — Role definitions + prompts
- `src/agents/codeclaw-roles/types.ts` — role type, context strategy enum
- `src/agents/codeclaw-roles/prompts/` — one prompt template per role
- `src/agents/codeclaw-roles/index.ts` — role registry, prompt hydration

### Step 2 — Task packet extension
- Add `role`, `rolePrompt`, `allowedTools`, `forbiddenTools`, `contextStrategy` to `CodeClawTaskPacket`
- Update `buildCodeClawTaskPacket()` to accept role and hydrate accordingly
- Update `formatCodeClawTaskPacket()` to include role prompt in agent instructions

### Step 3 — Context strategy implementation
- Wire `contextStrategy` to AlphaIota slice selection:
  - `full` → entire `context.txt`
  - `summary` → first N lines (repo + folder level only)
  - `scoped` → keyword-based slice (existing `selectAlphaIotaContextSlice`)
  - `state-only` → no source context, just project state

### Step 4 — Spawn path integration
- Update spawn path to use role-aware packets
- Role prompt injected as system prompt addition
- Tool filtering applied based on role allowlist

### Step 5 — Orchestrator MVP
- Team Lead agent that can decompose a goal and spawn role-specific sub-agents
- Simple sequential lifecycle first, parallel later

### Step 6 — Tests
- Unit tests for role prompt hydration
- Unit tests for context strategy selection
- Integration test: mock task → role packet → formatted output
