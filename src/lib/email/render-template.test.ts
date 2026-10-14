import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "./render-template";

describe("renderEmailTemplate", () => {
  it("substitutes a single token", () => {
    expect(renderEmailTemplate("Hi {{firstName}}!", { firstName: "Ben" })).toBe("Hi Ben!");
  });

  it("substitutes multiple occurrences of the same token", () => {
    expect(renderEmailTemplate("{{name}} {{name}}", { name: "Ben" })).toBe("Ben Ben");
  });

  it("substitutes multiple distinct tokens", () => {
    expect(renderEmailTemplate("{{first}} {{last}}", { first: "Ben", last: "Fisher" })).toBe("Ben Fisher");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderEmailTemplate("Hi {{ firstName }}!", { firstName: "Ben" })).toBe("Hi Ben!");
  });

  it("replaces an unknown token with an empty string rather than leaving it literal", () => {
    expect(renderEmailTemplate("Hi {{unknownToken}}!", { firstName: "Ben" })).toBe("Hi !");
  });

  it("leaves a template with no tokens unchanged", () => {
    expect(renderEmailTemplate("Hello world", {})).toBe("Hello world");
  });

  it("does not treat HTML in a substituted value as a template token", () => {
    const result = renderEmailTemplate("{{body}}", { body: "<p>{{not a real token}}</p>" });
    expect(result).toBe("<p>{{not a real token}}</p>");
  });
});
