import { describe, expect, it } from "vitest";
import { decidePdOpponentAction } from "@/engine/repeated/policies";

describe("P2 PD opponent policies", () => {
  it("plays the fixed action for Saint and Cynic", () => {
    expect(decidePdOpponentAction("always:C", [1, 1])).toBe(0);
    expect(decidePdOpponentAction("always:D", [0, 0])).toBe(1);
  });

  it("starts cooperative and then mirrors the player's latest action", () => {
    expect(decidePdOpponentAction("tft", [])).toBe(0);
    expect(decidePdOpponentAction("tft", [0, 1, 0])).toBe(0);
    expect(decidePdOpponentAction("tft", [0, 0, 1])).toBe(1);
  });
});
