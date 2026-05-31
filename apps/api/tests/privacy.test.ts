import { describe, expect, it } from "vitest";
import { maskSensitiveText } from "../src/services/privacy.js";

describe("maskSensitiveText", () => {
  it("masks contact details and tokens in generated output", () => {
    const masked = maskSensitiveText("Email mayur@example.com, phone +91 97279 28102, GitHub github.com/Mayur-katla, token ghp_abcdefghijklmnopqrstuvwxyz123456");

    expect(masked).toContain("m***@example.com");
    expect(masked).toContain("+91 ******8102");
    expect(masked).toContain("github.com/M***r-k***a");
    expect(masked).toContain("[redacted-github-token]");
  });
});
