import { describe, expect, it } from "vitest";
import {
  buildBASecurityNotification,
  buildSecurityScanDirective,
  parseSecurityFindings,
} from "./security-scan.js";

describe("security scan helpers", () => {
  it("buildSecurityScanDirective includes commit and changed files", () => {
    const directive = buildSecurityScanDirective({
      repoRoot: "/repo/demo",
      commitHash: "abc123",
      diffSummary: "Updated auth middleware",
      changedFiles: ["src/auth.ts", "src/db.ts"],
    });

    expect(directive).toContain("Commit: abc123");
    expect(directive).toContain("- src/auth.ts");
    expect(directive).toContain("- src/db.ts");
    expect(directive).toContain("Output Format");
  });

  it("parseSecurityFindings parses markdown finding blocks", () => {
    const findings = parseSecurityFindings(`
- Severity: high
- File: src/auth.ts:42
- Title: Unsanitized SQL string interpolation
- Description: User input flows into SQL string without parameterization.
- Remediation: Use parameterized queries via prepared statements.

- Severity: low
- File: src/logger.ts
- Title: Debug endpoint leaks stack traces
- Description: Stack traces could reveal internal paths.
- Remediation: Hide stack traces in production responses.
`);

    expect(findings).toEqual([
      {
        severity: "high",
        file: "src/auth.ts",
        line: 42,
        title: "Unsanitized SQL string interpolation",
        description: "User input flows into SQL string without parameterization.",
        remediation: "Use parameterized queries via prepared statements.",
      },
      {
        severity: "low",
        file: "src/logger.ts",
        title: "Debug endpoint leaks stack traces",
        description: "Stack traces could reveal internal paths.",
        remediation: "Hide stack traces in production responses.",
      },
    ]);
  });

  it("buildBASecurityNotification formats findings for BA ticket creation", () => {
    const directive = buildBASecurityNotification({
      commitHash: "def456",
      findings: [
        {
          severity: "critical",
          file: "src/secrets.ts",
          line: 9,
          title: "Hardcoded production API key",
          description: "A live key is committed in source control.",
          remediation: "Rotate key immediately and replace with env var lookup.",
        },
      ],
    });

    expect(directive).toContain("# BA Security Notification");
    expect(directive).toContain("Commit: def456");
    expect(directive).toContain("(CRITICAL)");
    expect(directive).toContain("src/secrets.ts:9");
  });
});
