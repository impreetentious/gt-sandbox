import { describe, expect, it } from "vitest";
import {
  curriculum,
  initialProgress,
  isComplete,
  isUnlocked,
  nextStep,
  parseProgress,
  serializeProgress,
  withCompleted,
  withGating,
} from "@/state/curriculum";

const firstId = curriculum[0].id;
const secondId = curriculum[1].id;
const lastId = curriculum[curriculum.length - 1].id;

describe("V2-P10 curriculum progression", () => {
  it("opens only the first stop on a fresh start", () => {
    expect(isUnlocked(initialProgress, firstId)).toBe(true);
    expect(isUnlocked(initialProgress, secondId)).toBe(false);
    expect(isUnlocked(initialProgress, lastId)).toBe(false);
    expect(nextStep(initialProgress)?.id).toBe(firstId);
  });

  it("opens the next stop once the previous one is done", () => {
    const progress = withCompleted(initialProgress, firstId, true);

    expect(isComplete(progress, firstId)).toBe(true);
    expect(isUnlocked(progress, secondId)).toBe(true);
    expect(nextStep(progress)?.id).toBe(secondId);
  });

  it("opens everything when gating is turned off, without losing progress", () => {
    // This is the acceptance the phase turns on: one control, and the locks are
    // gone. Progress has to survive it, or turning the gate off would read as a
    // punishment for having asked.
    const progress = withGating(
      withCompleted(initialProgress, firstId, true),
      false,
    );

    expect(progress.completed).toEqual([firstId]);
    for (const step of curriculum) {
      expect(isUnlocked(progress, step.id)).toBe(true);
    }
  });

  it("re-locks later stops when gating is turned back on", () => {
    const opened = withGating(initialProgress, false);
    const closed = withGating(opened, true);

    expect(isUnlocked(closed, secondId)).toBe(false);
  });

  it("never re-locks a stop that was completed out of order", () => {
    // Arriving from the ungated home arc can complete a later stop first.
    const progress = withCompleted(initialProgress, lastId, true);

    expect(isComplete(progress, lastId)).toBe(true);
    expect(nextStep(progress)?.id).toBe(firstId);
  });

  it("keeps completed stops in curriculum order regardless of when they landed", () => {
    const progress = withCompleted(
      withCompleted(initialProgress, secondId, true),
      firstId,
      true,
    );

    expect(progress.completed).toEqual([firstId, secondId]);
  });

  it("un-marks a stop without disturbing the others", () => {
    const both = withCompleted(
      withCompleted(initialProgress, firstId, true),
      secondId,
      true,
    );
    const undone = withCompleted(both, firstId, false);

    expect(undone.completed).toEqual([secondId]);
    expect(isUnlocked(undone, secondId)).toBe(false);
  });

  it("ignores an id that is not part of the curriculum", () => {
    expect(withCompleted(initialProgress, "not-a-stop", true)).toEqual(
      initialProgress,
    );
    expect(isUnlocked(initialProgress, "not-a-stop")).toBe(false);
  });

  it("round-trips through storage", () => {
    const progress = withGating(
      withCompleted(initialProgress, firstId, true),
      false,
    );

    expect(parseProgress(serializeProgress(progress))).toEqual(progress);
  });

  it("treats missing, malformed, and hostile stored values as a fresh start", () => {
    expect(parseProgress(null)).toEqual(initialProgress);
    expect(parseProgress("not json")).toEqual(initialProgress);
    expect(parseProgress("null")).toEqual(initialProgress);
    expect(parseProgress("[1,2,3]").completed).toEqual([]);
    expect(parseProgress('{"completed":"everything"}').completed).toEqual([]);
  });

  it("discards stored ids that are not in the current curriculum", () => {
    // A stale key from an earlier curriculum would otherwise count towards
    // unlocking, opening stops the reader never reached.
    const stored = JSON.stringify({
      gated: true,
      completed: ["retired-stop", 7, null, firstId],
    });

    const progress = parseProgress(stored);

    expect(progress.completed).toEqual([firstId]);
    expect(isUnlocked(progress, secondId)).toBe(true);
  });

  it("defaults an absent gate to on rather than off", () => {
    expect(parseProgress("{}").gated).toBe(true);
    expect(parseProgress('{"gated":false}').gated).toBe(false);
    expect(parseProgress('{"gated":"no"}').gated).toBe(true);
  });

  it("reports the path finished once every stop is done", () => {
    const finished = curriculum.reduce(
      (progress, step) => withCompleted(progress, step.id, true),
      initialProgress,
    );

    expect(nextStep(finished)).toBeUndefined();
    expect(finished.completed).toHaveLength(curriculum.length);
  });

  it("points every stop at a distinct route with a single concept", () => {
    expect(new Set(curriculum.map((step) => step.id)).size).toBe(
      curriculum.length,
    );
    expect(new Set(curriculum.map((step) => step.href)).size).toBe(
      curriculum.length,
    );

    for (const step of curriculum) {
      expect(step.href.startsWith("/")).toBe(true);
      expect(step.href.endsWith("/")).toBe(true);
      expect(step.concept.length).toBeGreaterThan(0);
    }
  });
});
