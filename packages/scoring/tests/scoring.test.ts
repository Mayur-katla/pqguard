import { describe, expect, it } from "vitest";
import { analyzeProof, detectUniversalContext, scoreArtifact } from "../src/index.js";

describe("scoreArtifact", () => {
  it("flags hollow PR language", () => {
    const result = scoreArtifact({
      kind: "pull_request",
      title: "Improve things",
      body: "This comprehensive update improves overall quality, enhances user experience, and follows best practices with various fixes.",
      files: [{ filename: "src/auth.ts", patch: "+ if (!token) throw new Error('missing token')" }],
      commits: [{ message: "minor improvements" }, { message: "minor improvements and cleanup" }]
    });

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(["Flag", "Block"]).toContain(result.band);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("keeps concrete PR text below flag range", () => {
    const result = scoreArtifact({
      kind: "pull_request",
      title: "Validate missing auth token in session refresh",
      body: "Adds a guard in src/auth/session.ts so refreshSession returns 401 when the bearer token is missing. Includes a unit test for the expired-token path.",
      files: [{ filename: "src/auth/session.ts", patch: "+ if (!bearerToken) return res.status(401).json({ error: 'missing token' })" }],
      commits: [{ message: "Add token guard to refreshSession" }, { message: "Cover missing bearer token response" }]
    });

    expect(result.score).toBeLessThan(60);
  });
});

describe("detectUniversalContext", () => {
  it("recognizes code review context", () => {
    expect(detectUniversalContext("This pull request updates the commit flow")).toBe("Code review");
  });
});

describe("analyzeProof", () => {
  it("gives weak proof to unsupported hiring claims", () => {
    const result = analyzeProof({
      mode: "hiring",
      kind: "universal_text",
      title: "Cover letter",
      body: "I am a results-driven team player with a proven track record of delivering dynamic solutions."
    });

    expect(result.proofScore).toBeLessThan(50);
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.fixPlan.length).toBeGreaterThan(0);
  });

  it("gives stronger proof to actionable communications", () => {
    const result = analyzeProof({
      mode: "communications",
      kind: "universal_text",
      title: "Release ask",
      body: "Maya owns the release checklist. Please review payment rollback by 4 PM today so we can ship tomorrow."
    });

    expect(result.proofScore).toBeGreaterThanOrEqual(50);
    expect(result.missingProof.some((item) => item.label === "Owner present" && item.passed)).toBe(true);
  });
});
