import { describe, expect, it } from "vitest";
import { oneShotGameContent } from "@/content/one-shot-games";

describe("P5 authored one-shot copy", () => {
  it("keeps the editorial voice and insight budget in bounds", () => {
    for (const content of Object.values(oneShotGameContent)) {
      expect(content.insights.length).toBeLessThanOrEqual(2);
      expect(content.framing).not.toMatch(/!|let's dive in/i);
      expect(
        content.personas.map((persona) => persona.description).join(" "),
      ).not.toMatch(/!|let's dive in/i);
    }
  });
});
