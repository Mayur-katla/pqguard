import { describe, expect, it } from "vitest";
import { parseRepoUrl, RepoUrlError } from "../src/services/github.js";

describe("parseRepoUrl", () => {
  it("parses GitHub URLs", () => {
    expect(parseRepoUrl("https://github.com/openai/openai-node")).toMatchObject({
      owner: "openai",
      name: "openai-node"
    });
  });

  it("parses owner repo shorthand", () => {
    expect(parseRepoUrl("vercel/next.js")).toMatchObject({
      owner: "vercel",
      name: "next.js"
    });
  });

  it("rejects invalid repository input with a user-facing error", () => {
    expect(() => parseRepoUrl("not a url with spaces")).toThrow(RepoUrlError);
  });
});
