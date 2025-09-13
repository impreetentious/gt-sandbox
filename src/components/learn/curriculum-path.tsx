"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
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
  CURRICULUM_KEY,
  type CurriculumProgress,
} from "@/state/curriculum";

/**
 * V2-P10 — the guided path.
 *
 * Two things keep this from being condescending. The gate is opt-out from a
 * single checkbox at the top, stated plainly rather than buried; and turning it
 * off is presented as a normal way to use the product, not as skipping ahead.
 * Nothing behind a lock is unavailable elsewhere — every stop is one click from
 * the home arc, which stays ungated by design.
 *
 * Progress is one localStorage key holding one JSON object. Marking a stop done
 * is an explicit act, and following its link marks it too, because a reader who
 * went and did the thing should not also have to file a report about it.
 */
export function CurriculumPath() {
  const [progress, setProgress] = useState<CurriculumProgress>(initialProgress);
  const gateId = useId();
  const statusId = useId();

  useEffect(() => {
    // Deferred by a zero timer, the house pattern for reading storage after
    // hydration rather than cascading a render inside the effect.
    const timer = window.setTimeout(() => {
      try {
        setProgress(parseProgress(window.localStorage.getItem(CURRICULUM_KEY)));
      } catch {
        // Blocked storage means the path works for this visit only.
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const persist = (next: CurriculumProgress) => {
    setProgress(next);

    try {
      window.localStorage.setItem(CURRICULUM_KEY, serializeProgress(next));
    } catch {
      // Same as above: the path still works, it just will not be remembered.
    }
  };

  const clear = () => {
    setProgress(initialProgress);

    try {
      window.localStorage.removeItem(CURRICULUM_KEY);
    } catch {
      // Nothing to clear if storage was never available.
    }
  };

  const done = progress.completed.length;
  const upcoming = nextStep(progress);

  return (
    <div className="curriculum">
      <div className="curriculum__controls">
        <label className="curriculum__gate" htmlFor={gateId}>
          <input
            checked={!progress.gated}
            id={gateId}
            onChange={(event) =>
              persist(withGating(progress, !event.target.checked))
            }
            type="checkbox"
          />
          Open every stop now
        </label>
        <button className="analysis-button" onClick={clear} type="button">
          Start the path over
        </button>
      </div>
      <p className="curriculum__status" id={statusId} role="status">
        {done} of {curriculum.length} stops done.{" "}
        {progress.gated
          ? upcoming
            ? `Next: ${upcoming.title}.`
            : "The whole path is finished — every surface stays open."
          : "Gating is off; every stop is open."}
      </p>
      <ol className="curriculum__list">
        {curriculum.map((step, index) => {
          const complete = isComplete(progress, step.id);
          const open = isUnlocked(progress, step.id);

          return (
            <li
              className="curriculum__step"
              data-state={complete ? "done" : open ? "open" : "locked"}
              key={step.id}
            >
              <p className="curriculum__index">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div>
                <h2>
                  {open ? (
                    <Link
                      href={step.href}
                      onClick={() =>
                        persist(withCompleted(progress, step.id, true))
                      }
                    >
                      {step.title}
                    </Link>
                  ) : (
                    step.title
                  )}
                </h2>
                <p className="curriculum__concept">{step.concept}</p>
                <p>{step.why}</p>
                {open ? (
                  <label className="curriculum__done">
                    <input
                      checked={complete}
                      onChange={(event) =>
                        persist(
                          withCompleted(
                            progress,
                            step.id,
                            event.target.checked,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    Mark this stop done
                  </label>
                ) : (
                  <p className="curriculum__locked-note">
                    Locked until the stop above is done — or open the whole path
                    with the control at the top. It is also reachable directly
                    from the home arc, which never gates anything.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
