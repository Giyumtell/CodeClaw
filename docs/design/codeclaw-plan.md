# CodeClaw Plan

## Goal

Turn CodeClaw from a general personal-agent gateway into a **context-aware software-building system**.

The winning loop is:

1. user gives an idea or an existing repo
2. CodeClaw ingests the repo with AlphaIota
3. CodeClaw builds a compact architecture map (`context.txt` + structured graph)
4. CodeClaw decomposes work into scoped tasks
5. CodeClaw spawns coding agents with only the relevant context slice
6. CodeClaw reviews, tests, tracks progress, and intervenes when work stalls

This is not "AI chat with tools". This is **tech-lead orchestration over a codebase knowledge layer**.

---

## Product Positioning

### What OpenClaw is today

- personal AI gateway
- strong channel/device/tooling surface
- flexible runtime/session model
- good human-assistant workflows

### What CodeClaw should become

- **builder mode first**
- repo-aware task execution
- context-sliced coding agents
- project heartbeat / milestone tracking
- assign-work / review-work / recover-stalled-work loop

### Core moat

Most coding agents either:

- dump the whole repo into context, or
- explore blindly file-by-file.

CodeClaw should instead use **AlphaIota as the codebase brain**:

- hierarchical map of repo
- dependency graph
- summaries at repo/folder/file/class/method levels
- compact context export for cheap navigation

---

## Build Principles

1. **Integrate, don't rewrite.**
   Reuse OpenClaw's session, tool, cron, browser, and messaging machinery.
2. **AlphaIota is the context brain.**
   Do not duplicate its parsing/indexing logic inside CodeClaw.
3. **Repo assignment is explicit.**
   A build session should know which repo/workspace it owns.
4. **Agents get scoped context, not whole-repo sludge.**
5. **Every agent task should be inspectable.**
   Inputs, outputs, touched files, status, tests, blockers.
6. **Heartbeat should act like an engineering manager.**
   Detect stalls, failures, drift, and unfinished next steps.

---

## Architecture Direction

### Layer 1 — Repo Context Bridge

Bridge CodeClaw to AlphaIota output.

Required capabilities:

- assign a repo/workspace to a session or task
- discover `.alphai/context.txt` and AlphaIota DB/artifacts
- fetch targeted context slices for a task
- expose "what files/classes matter for this task?"

This should plug into the existing `src/context-engine/` system rather than inventing a parallel stack.

### Layer 2 — Project / Task Model

CodeClaw needs first-class build entities:

- project
- repo assignment
- task
- milestone
- agent run
- status / blocker / completion evidence

This can start as lightweight filesystem/JSON state, then graduate later if needed.

### Layer 3 — Orchestrator

Given a project goal, the orchestrator should:

- break work into tasks
- decide execution order
- choose the right agent/runtime
- attach the right AlphaIota context slice
- require tests / verification / summaries

### Layer 4 — Monitoring + Recovery

Heartbeat / cron / status should answer:

- is work progressing?
- which task is active?
- what changed recently?
- did tests pass?
- is an agent stuck?
- what is the next intervention?

---

## Phase Plan

## Phase 0 — Foundation / Planning (now)

Ship the plan and define the integration seam.

Deliverables:

- this plan doc
- design doc for AlphaIota integration through `context-engine`
- explicit MVP slice and sequence

## Phase 1 — AlphaIota Integration MVP

**Objective:** make CodeClaw repo-aware.

Deliverables:

- repo assignment model for a session/task
- AlphaIota artifact discovery (`.alphai/context.txt`, DB path, config)
- minimal context bridge API:
  - load repo summary
  - load tree summary
  - select relevant paths for a prompt
- first "repo-aware assemble" path in context engine or adjacent integration point

Success looks like:

- a CodeClaw run can be pointed at a repo
- the agent sees compact architecture context before exploring source

## Phase 2 — Builder Workflow MVP

**Objective:** assign engineering work against a repo.

Deliverables:

- command / flow like:
  - `build project from repo`
  - `assign task`
  - `show project status`
- task record with:
  - objective
  - target repo
  - relevant files
  - acceptance criteria
  - current status
- subagent spawn helper that packages AlphaIota context for the task

Success looks like:

- CodeClaw can receive a repo task and launch a coding agent with focused repo context

## Phase 3 — Progress Tracking + Heartbeat

**Objective:** monitor active work without babysitting.

Deliverables:

- project worklog / status state
- heartbeat check for active projects
- recent git activity + changed-files analysis
- stalled-task detection
- short operator updates

Success looks like:

- CodeClaw notices when a task completed, failed, or stalled, and says something useful

## Phase 4 — Review / Verify / Iterate

**Objective:** make the loop reliable.

Deliverables:

- post-task verification hooks
- test result capture
- diff summary generation
- follow-up task generation when work is incomplete
- optional critic/reviewer pass before marking done

Success looks like:

- CodeClaw behaves like a lightweight tech lead, not just a task launcher

## Phase 5 — Greenfield App Mode

**Objective:** go from idea → app.

Deliverables:

- project bootstrap flow for net-new app ideas
- repo creation / scaffold path
- planning → task graph → implementation loop
- progress dashboard / milestone summary

This phase comes **after** repo-aware execution is working well.

---

## MVP Scope (do this first)

The first real MVP is **not** full autonomy.
It is:

> Point CodeClaw at an existing repo, assign a task, spawn a coding agent with AlphaIota context, track status, and report back.

That is enough to prove the core edge.

---

## Immediate Next Tasks

1. Add a design doc for **AlphaIota ↔ CodeClaw integration via context-engine**.
2. Decide where repo assignment state lives (session metadata, project file, or both).
3. Implement a first artifact-discovery module for `.alphai/`.
4. Implement a first context-selection helper for task prompts.
5. Wire that helper into one agent spawn path.
6. Add tests around repo assignment and artifact discovery.
7. Introduce a reusable CodeClaw task packet format so repo/task metadata can be handed to coding agents cleanly.

---

## What We Are Explicitly Not Doing Yet

- replacing OpenClaw's entire runtime
- rebuilding AlphaIota inside CodeClaw
- giant multi-agent hierarchy systems
- full PM dashboard before repo-aware execution works
- SaaS/platform fantasies before local workflow is solid

---

## Short Version

CodeClaw should be:

**OpenClaw's runtime + AlphaIota's repo brain + task orchestration for software delivery.**

That means the first implementation target is obvious:

**make the context engine repo-aware, then make task execution use it.**
