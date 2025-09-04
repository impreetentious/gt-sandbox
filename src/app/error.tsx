"use client";

export default function RouteError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section aria-labelledby="route-error-title" className="not-found">
      <p className="eyebrow">Error / Outside the model</p>
      <h1 className="display" id="route-error-title">
        Something failed to compute.
      </h1>
      <p className="lede">
        The state on screen may be stale. Try again, or return to the start.
      </p>
      <button className="analysis-button" onClick={reset} type="button">
        Try again
      </button>
    </section>
  );
}
