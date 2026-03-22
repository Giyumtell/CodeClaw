# ⚡ CodeClaw — AI Scrum Team That Builds Your Software

<p align="center">
  <strong>Describe it. CodeClaw builds it.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**CodeClaw** is a multi-agent coding platform that simulates a real software team. You talk to a **Team Lead**. The Team Lead spawns a **PM**, **BA**, **Developers**, **Testers**, a **Code Reviewer**, and a **Security Engineer** — each with their own identity, memory, tools, and model. They coordinate through a scrum board, enforce chain of command, and ship working software.

Built on [OpenClaw](https://github.com/openclaw/openclaw) — inherits its full platform: Gateway, channels, dashboard, voice, nodes, browser control, canvas, cron, and 20+ messaging integrations.

## How It Works

```
You: "Build me a task management API with auth"
                    │
                    ▼
            ┌──────────────┐
            │  Team Lead    │  ← You talk to TL only
            │  (persistent) │
            └──────┬───────┘
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
    ┌─────────┐ ┌──────┐ ┌──────────┐
    │   PM    │ │  BA  │ │ Reviewer │
    │(persist)│ │(pers)│ │(per-task)│
    └────┬────┘ └──┬───┘ └──────────┘
         │         │
    ┌────┼────┐    │
    ▼    ▼    ▼    ▼
  Dev  Dev  Tester Security
  (spawn per task)  (persistent)
```

**Chain of command:**
- **You → Team Lead** — the only agent you interact with
- **Team Lead → PM** — TL delegates execution management
- **PM → Developer / Tester / BA** — PM routes day-to-day work
- **Security → BA → PM → Developer** — security findings become fix tickets
- **Reviewer → Team Lead** — code quality gate, independent from delivery pressure

## What Makes It Different

| Feature | Cursor / Copilot / Devin | CodeClaw |
|---------|-------------------------|----------|
| Context | Dumps whole repo or explores blind | **AlphaIota** indexes codebase, slices per-role |
| Agents | Single agent, single personality | 7 specialized roles with own memory + soul |
| Process | Ad-hoc | Scrum lifecycle: requirements → planning → dev → test → review → ship |
| Security | Manual | Dedicated security agent scans every commit |
| Continuity | Stateless | TL/PM/BA/Security persist across project lifecycle |
| Quality gate | None | Independent reviewer reports to TL, not PM |

## Roles

| Role | Agent ID | Context | Persists | Reports To |
|------|----------|---------|----------|------------|
| **Team Lead** | `codeclaw-team-lead` | Full codebase | ✓ | You |
| **Project Manager** | `codeclaw-project-manager` | Board/state only | ✓ | Team Lead |
| **Business Analyst** | `codeclaw-business-analyst` | Summary (architecture) | ✓ | PM |
| **Developer** | `codeclaw-developer` | Scoped (task-relevant) | ✗ | PM |
| **Tester** | `codeclaw-tester` | Scoped (task-relevant) | ✗ | PM |
| **Code Reviewer** | `codeclaw-reviewer` | Full codebase | ✗ | Team Lead |
| **Security Engineer** | `codeclaw-security` | Scoped (commit diffs) | ✓ | BA |

Each role has:
- **Own SOUL.md** — personality, boundaries, expertise
- **Own MEMORY.md** — persistent memory across tasks
- **Own model** — configurable per role
- **Allowed/forbidden actions** — devs can't redefine requirements, testers can't merge, PM can't write code

## Quick Start

### Install

Runtime: **Node 24 (recommended) or Node 22.16+**.

```bash
npm install -g codeclaw@latest

codeclaw onboard --install-daemon
```

### Create a Project

```bash
# Initialize a new project (or point at existing repo)
codeclaw codeclaw init --repo-root ~/my-app --name "My App" --goal "Task management API with JWT auth and PostgreSQL"

# Plan the run (creates scrum board + task assignments)
codeclaw codeclaw plan --repo-root ~/my-app

# View the board
codeclaw codeclaw board --repo-root ~/my-app

# Execute (spawns agents through the full lifecycle)
codeclaw codeclaw run-all --repo-root ~/my-app

# Check progress
codeclaw codeclaw progress --repo-root ~/my-app
```

### Or Just Talk to Team Lead

Open the dashboard or any connected channel (Telegram, Discord, Slack, WhatsApp...) and describe what you want:

> "Build me a REST API for task management with user auth, PostgreSQL storage, and full test coverage."

Team Lead asks you clarifying questions as the stakeholder, then proceeds to decompose, plan, and execute with the full team.

## The Scrum Board

CodeClaw maintains a dual-format scrum board:

- **`.codeclaw/board.md`** — human-readable markdown
- **`.codeclaw/board-state.json`** — machine-readable JSON

```markdown
# CodeClaw Board — My App

## Backlog
- [ ] #3 — Implement auth middleware | developer | codeclaw-developer

## In Progress
- [ ] #1 — Define API requirements | business-analyst | codeclaw-business-analyst

## Done
- [x] #0 — Gather requirements from stakeholder | team-lead | codeclaw-team-lead
```

Tasks flow through: **backlog → in-progress → review → done** (or **blocked** if stalled).

## AlphaIota — The Context Brain

CodeClaw uses [AlphaIota](https://github.com/your-repo/alphaIota) to understand your codebase before any agent writes a line of code.

**What it does:**
- Indexes your repo with tree-sitter (632+ node types)
- Builds hierarchical context trees
- Generates `context.txt` (~22K tokens, 5x compression vs raw source)
- Stored in `.alphai/` (gitignored)

**How CodeClaw uses it:**
- **Team Lead + Reviewer** get the full context (architecture-level decisions)
- **BA** gets a summary (first 80 lines — architecture overview)
- **Developer + Tester** get scoped slices (keyword-matched to their task)
- **PM** skips code context (operates on board/orchestrator state)
- **Security** gets scoped context (commit diffs + affected files)

Context injection is **mandatory and automatic**. Agents never spawn blind.

## Security Agent

The Security Engineer is a persistent, always-on role that:

- **Wakes on every commit** — scans diffs automatically
- **Scans for:** hardcoded secrets, OWASP top 10, injection risks, XSS, auth/authz issues, insecure dependencies, dangerous file handling, crypto/session mistakes
- **Reports to BA** — BA creates fix tickets, PM routes to developers
- **Remembers past findings** — builds pattern memory, tracks false positives

Security chain: **Security → BA → PM → Developer**

Not direct to dev. Not lost in review noise.

## Persistent Sessions

Management roles (TL, PM, BA, Security) maintain **persistent sessions** across the project lifecycle:

- Same Team Lead keeps architecture context
- Same PM keeps execution state
- Same BA keeps requirement history
- Same Security agent keeps vulnerability pattern memory

Tracked in `.codeclaw/sessions.json`. If a persistent session dies, it respawns with its memory intact.

IC roles (Developer, Tester, Reviewer) spawn fresh per task — ephemeral workers with scoped context.

## Orchestrator Phases

```
requirements → planning → development → testing → review → [rework] → done
```

The orchestrator advances phases automatically. If review finds issues, it cycles back to rework. The heartbeat monitor detects stalled agents (10min threshold) and marks tasks as blocked.

## CLI Commands

```bash
codeclaw codeclaw init        # Initialize project
codeclaw codeclaw plan        # Plan the run (create board + tasks)
codeclaw codeclaw execute     # Execute next step
codeclaw codeclaw run-all     # Auto-loop: plan → execute → complete → repeat
codeclaw codeclaw complete    # Mark current task done/blocked
codeclaw codeclaw board       # View scrum board
codeclaw codeclaw status      # Orchestrator status
codeclaw codeclaw progress    # Health check + stall detection
codeclaw codeclaw sessions    # View persistent agent sessions
```

## Dashboard

The Control UI includes a **CodeClaw tab** with:

- **Kanban board** — 5 columns (backlog, in-progress, review, done, blocked)
- **Task cards** — expandable, role-colored chips, assignment info
- **Phase indicator** — current orchestrator phase
- **Run plan pipeline** — visual lifecycle progress
- **Project setup form** — initialize new projects from the UI

## Gateway Methods

```
codeclaw.init       — Initialize a project
codeclaw.plan       — Plan the lifecycle run
codeclaw.board      — Get/update scrum board
codeclaw.status     — Orchestrator state
codeclaw.execute    — Execute next step
codeclaw.complete   — Mark task done/blocked
codeclaw.advance    — Advance orchestrator phase
codeclaw.next       — Get next step without executing
codeclaw.progress   — Health check + stall detection
codeclaw.sessions   — Query persistent sessions
```

## Configuration

CodeClaw extends the standard OpenClaw config:

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-6",  // default model
  },
  agents: {
    list: [
      { id: "codeclaw-team-lead", model: "anthropic/claude-opus-4-6" },
      { id: "codeclaw-project-manager", model: "openai/gpt-5.3" },
      { id: "codeclaw-business-analyst", model: "openai/gpt-5.3" },
      { id: "codeclaw-developer", model: "openai/gpt-5.3-codex" },
      { id: "codeclaw-tester", model: "openai/gpt-5.3-codex" },
      { id: "codeclaw-reviewer", model: "anthropic/claude-opus-4-6" },
      { id: "codeclaw-security", model: "anthropic/claude-opus-4-6" },
    ]
  }
}
```

Each role agent gets its own:
- `~/.codeclaw/agents/{role}/SOUL.md` — personality + boundaries
- `~/.codeclaw/agents/{role}/MEMORY.md` — persistent memory
- Configurable model (different models for different roles)

## Everything From OpenClaw

CodeClaw inherits the full OpenClaw platform:

### Channels
WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage (BlueBubbles), IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, WebChat — talk to your Team Lead from anywhere.

### Platform
- **Local-first Gateway** — single WS control plane
- **Multi-agent routing** — isolated agents per channel/account
- **Voice Wake + Talk Mode** — wake words on macOS/iOS, continuous voice on Android
- **Live Canvas** — agent-driven visual workspace
- **Browser control** — CDP-based Chrome/Chromium automation
- **Companion apps** — macOS menu bar, iOS/Android nodes
- **Cron + webhooks** — scheduled tasks, external triggers, Gmail Pub/Sub
- **Skills platform** — bundled, managed, workspace skills

### Security
- DM pairing (unknown senders get pairing code)
- Sandbox mode for non-main sessions (Docker isolation)
- Tool allowlists/denylists per role
- Tailscale Serve/Funnel for remote access

### Ops
- `codeclaw onboard` — guided setup
- `codeclaw doctor` — health diagnostics
- `codeclaw gateway` — daemon management
- Tailscale, SSH tunnels, Nix, Docker deployments

## Install (from source)

```bash
git clone https://github.com/your-repo/CodeClaw.git
cd CodeClaw

pnpm install
pnpm ui:build
pnpm build

pnpm openclaw onboard --install-daemon

# Dev loop
pnpm gateway:watch
```

## Project Structure

```
src/
├── agents/
│   ├── codeclaw-roles/        # 7 role definitions + prompts
│   ├── codeclaw-board/        # Scrum board (dual format)
│   ├── codeclaw-agents/       # Per-role agent configs + souls
│   ├── codeclaw-orchestrator/ # Phase machine + execution engine
│   ├── codeclaw-spawn/        # Agent spawn resolver
│   └── codeclaw-memory/       # Role memory + heartbeat
├── context-engine/
│   └── alphai-context-slice.ts  # AlphaIota context slicing
├── commands/
│   └── codeclaw.ts            # CLI commands
├── gateway/
│   └── server-methods/
│       └── codeclaw.ts        # Gateway API handlers
└── cli/
    └── program/
        └── register.codeclaw.ts  # CLI registration

ui/
├── src/ui/views/codeclaw.ts      # Dashboard kanban + controls
└── src/ui/controllers/codeclaw.ts # Dashboard state management

.codeclaw/                      # Per-project state (gitignored)
├── board.md                    # Human-readable scrum board
├── board-state.json            # Machine-readable board
├── orchestrator-state.json     # Phase machine state
└── sessions.json               # Persistent session tracking

~/.codeclaw/agents/{role}/      # Per-role agent directories
├── SOUL.md                     # Role personality + boundaries
└── MEMORY.md                   # Role persistent memory
```

## Stats

- **7 specialized agent roles** with enforced boundaries
- **91+ tests** across 14+ test files
- **~6500+ lines** of CodeClaw-specific code
- **10 gateway methods** for full lifecycle control
- **7 CLI subcommands**
- **Dual scrum board** (markdown + JSON)
- **Mandatory AlphaIota context** — agents never spawn blind
- **4 persistent roles** — management + security continuity

## Why CodeClaw

Current AI coding tools give you a single agent that either:
1. Dumps the entire repo into context and hopes for the best
2. Explores the codebase blindly, burning tokens on discovery

CodeClaw agents **know the architecture before writing a line of code**. Each role gets exactly the context slice it needs. The team enforces real engineering discipline — requirements before code, tests before merge, security before ship.

It's not a chatbot that writes code. It's a software team that ships products.

## License

MIT — same as OpenClaw.

## Credits

Built on [OpenClaw](https://github.com/openclaw/openclaw) by Peter Steinberger and the community.
Context engine powered by [AlphaIota](https://github.com/your-repo/alphaIota).
