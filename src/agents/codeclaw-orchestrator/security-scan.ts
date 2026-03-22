export interface SecurityFinding {
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line?: number;
  title: string;
  description: string;
  remediation: string;
}

export interface SecurityScanResult {
  commitHash: string;
  findings: SecurityFinding[];
  scannedFiles: string[];
  scanDate: string;
}

function parseSeverity(value: string): SecurityFinding["severity"] | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "critical") {
    return "critical";
  }
  if (normalized === "high") {
    return "high";
  }
  if (normalized === "medium") {
    return "medium";
  }
  if (normalized === "low") {
    return "low";
  }
  return null;
}

/**
 * Build a security scan directive for the security agent.
 * Given a commit hash, produces a task directive that tells the security agent
 * what to scan and how to report.
 */
export function buildSecurityScanDirective(params: {
  repoRoot: string;
  commitHash: string;
  diffSummary: string;
  changedFiles: string[];
}): string {
  const files = params.changedFiles.map((file) => file.trim()).filter(Boolean);
  const formattedFiles = files.length === 0 ? "- (none listed)" : files.map((file) => `- ${file}`);

  return [
    "# Security Scan Directive",
    "",
    "You are CodeClaw Security Engineer.",
    "",
    `Repository: ${params.repoRoot}`,
    `Commit: ${params.commitHash}`,
    "",
    "Focus Areas:",
    "- OWASP Top 10 risks",
    "- Hardcoded secrets and credentials",
    "- Injection (SQL/command/template), XSS, and unsafe deserialization",
    "- Authentication and authorization bypass risks",
    "- Dependency and supply-chain risk introduced by this change",
    "",
    "Changed Files:",
    ...formattedFiles,
    "",
    "Diff Summary:",
    params.diffSummary.trim() || "No diff summary provided.",
    "",
    "Output Format (repeat this block for each finding):",
    "- Severity: <critical|high|medium|low>",
    "- File: <path>:<line-optional>",
    "- Title: <short finding title>",
    "- Description: <what is wrong and why it is risky>",
    "- Remediation: <how to fix>",
    "",
    "If there are no findings, output exactly: `No security findings.`",
    "Report findings to Business Analyst for ticket creation.",
  ].join("\n");
}

/**
 * Parse security scan output from agent into structured findings.
 */
export function parseSecurityFindings(agentOutput: string): SecurityFinding[] {
  const lines = agentOutput.split(/\r?\n/);
  const findings: SecurityFinding[] = [];

  let pending: Partial<SecurityFinding> = {};

  function flushPending(): void {
    const severity = pending.severity;
    const file = pending.file;
    const title = pending.title;
    const description = pending.description;
    const remediation = pending.remediation;

    if (!severity || !file || !title || !description || !remediation) {
      pending = {};
      return;
    }

    findings.push({
      severity,
      file,
      line: pending.line,
      title,
      description,
      remediation,
    });
    pending = {};
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushPending();
      continue;
    }

    const severityMatch = /^[-*]\s*Severity:\s*(.+)$/i.exec(line);
    if (severityMatch) {
      flushPending();
      const severity = parseSeverity(severityMatch[1]);
      if (severity) {
        pending.severity = severity;
      }
      continue;
    }

    const fileMatch = /^[-*]\s*File:\s*(.+)$/i.exec(line);
    if (fileMatch) {
      const fileSpec = fileMatch[1].trim();
      const colonIndex = fileSpec.lastIndexOf(":");
      if (colonIndex > 0) {
        const candidateLine = Number.parseInt(fileSpec.slice(colonIndex + 1), 10);
        if (Number.isInteger(candidateLine) && candidateLine > 0) {
          pending.file = fileSpec.slice(0, colonIndex);
          pending.line = candidateLine;
          continue;
        }
      }
      pending.file = fileSpec;
      continue;
    }

    const titleMatch = /^[-*]\s*Title:\s*(.+)$/i.exec(line);
    if (titleMatch) {
      pending.title = titleMatch[1].trim();
      continue;
    }

    const descriptionMatch = /^[-*]\s*Description:\s*(.+)$/i.exec(line);
    if (descriptionMatch) {
      pending.description = descriptionMatch[1].trim();
      continue;
    }

    const remediationMatch = /^[-*]\s*Remediation:\s*(.+)$/i.exec(line);
    if (remediationMatch) {
      pending.remediation = remediationMatch[1].trim();
      continue;
    }
  }

  flushPending();
  return findings;
}

/**
 * Build a BA notification directive with security findings.
 * BA will create tickets for devs to fix.
 */
export function buildBASecurityNotification(params: {
  findings: SecurityFinding[];
  commitHash: string;
}): string {
  if (params.findings.length === 0) {
    return [
      "# BA Security Notification",
      "",
      `Commit: ${params.commitHash}`,
      "",
      "Security Engineer reported no findings.",
      "No tickets required.",
    ].join("\n");
  }

  const findingLines = params.findings.flatMap((finding, index) => {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    return [
      `## Finding ${index + 1} (${finding.severity.toUpperCase()})`,
      `- Title: ${finding.title}`,
      `- Location: ${location}`,
      `- Description: ${finding.description}`,
      `- Remediation: ${finding.remediation}`,
      "",
    ];
  });

  return [
    "# BA Security Notification",
    "",
    `Commit: ${params.commitHash}`,
    `Total Findings: ${params.findings.length}`,
    "",
    "Create implementation tickets for the Developer queue and track completion through PM.",
    "",
    ...findingLines,
  ]
    .join("\n")
    .trimEnd();
}
