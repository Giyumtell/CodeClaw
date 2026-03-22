import type { Command } from "commander";
import {
  codeClawAssignCommand,
  codeClawBoardCommand,
  codeClawCompleteCommand,
  codeClawExecuteCommand,
  codeClawInitCommand,
  codeClawNextCommand,
  codeClawProgressCommand,
  codeClawRunAllCommand,
  codeClawRunCommand,
  codeClawStatusCommand,
} from "../../commands/codeclaw.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";
import { collectOption } from "./helpers.js";

export function registerCodeClawCommands(program: Command) {
  const codeclaw = program
    .command("codeclaw")
    .description("Manage CodeClaw build projects and tasks")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/codeclaw", "docs.openclaw.ai/cli/codeclaw")}\n`,
    );

  codeclaw
    .command("init")
    .description("Initialize CodeClaw board and orchestrator artifacts")
    .option("--repo-root <dir>", "Repository root")
    .option("--project-name <name>", "Project name")
    .option("--agent-base-dir <dir>", "Agent base directory")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawInitCommand(
          {
            repoRoot: opts.repoRoot as string | undefined,
            projectName: opts.projectName as string | undefined,
            agentBaseDir: opts.agentBaseDir as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("run")
    .description("Plan a full CodeClaw run for a goal")
    .option("--repo-root <dir>", "Repository root")
    .requiredOption("--user-goal <text>", "High-level user goal")
    .option("--project-name <name>", "Project name")
    .option("--agent-base-dir <dir>", "Agent base directory")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawRunCommand(
          {
            repoRoot: opts.repoRoot as string | undefined,
            userGoal: opts.userGoal as string,
            projectName: opts.projectName as string | undefined,
            agentBaseDir: opts.agentBaseDir as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("next")
    .description("Resolve the next step from orchestrator state")
    .option("--repo-root <dir>", "Repository root")
    .option("--agent-base-dir <dir>", "Agent base directory")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawNextCommand(
          {
            repoRoot: opts.repoRoot as string | undefined,
            agentBaseDir: opts.agentBaseDir as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("board")
    .description("Show CodeClaw board state")
    .option("--repo-root <dir>", "Repository root")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawBoardCommand(
          {
            repoRoot: opts.repoRoot as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("progress")
    .description("Show CodeClaw phase progress and heartbeat health")
    .option("--repo-root <dir>", "Repository root")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawProgressCommand(
          {
            repoRoot: opts.repoRoot as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("execute")
    .description("Prepare and optionally spawn the next CodeClaw step")
    .option("--repo-root <dir>", "Repository root")
    .option("--agent-base-dir <dir>", "Agent base directory")
    .option("--json", "Output JSON instead of text", false)
    .option("--spawn", "Spawn via gateway after preparing step", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawExecuteCommand(
          {
            repoRoot: opts.repoRoot as string | undefined,
            agentBaseDir: opts.agentBaseDir as string | undefined,
            json: Boolean(opts.json),
            spawn: Boolean(opts.spawn),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("complete")
    .description("Mark a CodeClaw task as complete or blocked")
    .requiredOption("--repo-root <dir>", "Repository root")
    .requiredOption("--task-id <id>", "Task ID", parseInt)
    .option("--fail", "Mark as blocked instead of done", false)
    .option("--notes <text>", "Completion notes")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawCompleteCommand(
          {
            repoRoot: opts.repoRoot as string,
            taskId: opts.taskId as number,
            success: !opts.fail,
            notes: opts.notes as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("run-all")
    .description("Plan and execute all CodeClaw steps end-to-end")
    .option("--repo-root <dir>", "Repository root")
    .requiredOption("--user-goal <text>", "High-level goal")
    .option("--project-name <name>", "Project name")
    .option("--agent-base-dir <dir>", "Agent base directory")
    .option("--dry-run", "Show plan without executing", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawRunAllCommand(
          {
            repoRoot: opts.repoRoot as string | undefined,
            userGoal: opts.userGoal as string,
            projectName: opts.projectName as string | undefined,
            agentBaseDir: opts.agentBaseDir as string | undefined,
            dryRun: Boolean(opts.dryRun),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("assign")
    .description("Assign a new task to a repo-backed CodeClaw project")
    .requiredOption("--repo-root <dir>", "Repository root")
    .requiredOption("--objective <text>", "Task objective")
    .option("--title <text>", "Optional task title")
    .option("--workspace-name <name>", "Optional workspace label")
    .option("--acceptance <text>", "Acceptance criterion (repeatable)", collectOption, [])
    .option("--constraint <text>", "Constraint (repeatable)", collectOption, [])
    .option("--json", "Output JSON instead of text", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          [
            'openclaw codeclaw assign --repo-root ~/src/app --objective "add status command"',
            "Create the first tracked task.",
          ],
          [
            'openclaw codeclaw assign --repo-root ~/src/app --objective "wire task packets" --acceptance "spawn path uses packet"',
            "Store acceptance criteria with the task.",
          ],
        ])}`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawAssignCommand(
          {
            repoRoot: opts.repoRoot as string,
            objective: opts.objective as string,
            title: opts.title as string | undefined,
            workspaceName: opts.workspaceName as string | undefined,
            acceptanceCriteria: Array.isArray(opts.acceptance)
              ? (opts.acceptance as string[])
              : undefined,
            constraints: Array.isArray(opts.constraint) ? (opts.constraint as string[]) : undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  codeclaw
    .command("status")
    .description("Show tracked CodeClaw project/task state")
    .option("--repo-root <dir>", "Filter to one repository root")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await codeClawStatusCommand(
          {
            repoRoot: opts.repoRoot as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });
}
