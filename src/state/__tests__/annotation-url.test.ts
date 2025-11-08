import { describe, expect, it } from "vitest";

import {
  decodeAnnotation,
  MAX_ANNOTATION_CODE_POINTS,
  setAnnotation,
} from "@/state/annotation-url";

describe("annotation permalink codec", () => {
  it("round-trips a bounded annotation and removes an empty one", () => {
    const params = setAnnotation(new URLSearchParams("v=1"), "Check the outside option");
    expect(decodeAnnotation(params)).toBe("Check the outside option");
    expect(setAnnotation(params, "").has("a")).toBe(false);
  });

  it("fails closed on oversized query text", () => {
    const oversized = "x".repeat(MAX_ANNOTATION_CODE_POINTS + 1);
    expect(decodeAnnotation(new URLSearchParams({ a: oversized }))).toBeNull();
    expect(() => setAnnotation(new URLSearchParams(), oversized)).toThrow(/limited/);
  });
});
