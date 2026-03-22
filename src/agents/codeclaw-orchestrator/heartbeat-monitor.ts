import { buildProgressReport, handleStalledAgents } from "./progress.js";

export interface CodeClawHeartbeatCheckResult {
  healthy: boolean;
  report: Awaited<ReturnType<typeof buildProgressReport>>;
  warnings: string[];
  actions: string[];
}

export async function runHeartbeatCheck(params: {
  repoRoot: string;
}): Promise<CodeClawHeartbeatCheckResult> {
  let report = await buildProgressReport({ repoRoot: params.repoRoot });
  const warnings: string[] = [];
  const actions: string[] = [];

  if (!report) {
    warnings.push("CodeClaw is not initialized for this repository.");
    return {
      healthy: false,
      report: null,
      warnings,
      actions,
    };
  }

  let healthy = true;

  if (report.stalledAgents.length > 0) {
    const stalledCount = await handleStalledAgents({
      repoRoot: params.repoRoot,
      stalledLabels: report.stalledAgents,
    });
    warnings.push(`${report.stalledAgents.length} stalled agent(s) detected.`);
    if (stalledCount > 0) {
      actions.push(`Marked ${stalledCount} stalled task(s) as blocked.`);
      report = await buildProgressReport({ repoRoot: params.repoRoot });
    }
    healthy = false;
  }

  if (report && report.agents.length === 0 && report.completedTasks < report.totalTasks) {
    warnings.push("No agents are currently running while tasks remain.");
  }

  if (report && report.totalTasks > 0 && report.completedTasks === report.totalTasks) {
    actions.push("All tasks complete.");
  }

  return {
    healthy,
    report,
    warnings,
    actions,
  };
}
