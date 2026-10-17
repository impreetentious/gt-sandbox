"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { oneShotGameContent } from "@/content/one-shot-games";
import { pdPersonas } from "@/content/pd";
import { SESSION_FILE_BYTE_LIMIT } from "@/state/session-export";
import { formatRational } from "@/engine/rational";
import {
  ASSIGNMENT_TARGETS,
  buildAssignmentPath,
  type AssignmentSurface,
} from "@/state/assignment";
import {
  aggregateSubmissions,
  ingestSessionFile,
  submissionsToCsv,
  type ClassroomRejection,
  type ClassroomSubmission,
} from "@/state/classroom";

const SURFACE_LABEL: Record<AssignmentSurface, string> = {
  play: "Play (vs a persona)",
  "hot-seat": "Hot-seat (two people)",
  auction: "Auction",
};

function personaOptions(target: string): readonly { readonly id: string; readonly name: string }[] {
  if (target === "pd") {
    return pdPersonas.map((persona) => ({
      id: persona.id,
      name: persona.name,
    }));
  }
  const content = oneShotGameContent[target as keyof typeof oneShotGameContent];
  return content
    ? content.personas.map((persona) => ({
        id: persona.id,
        name: persona.name,
      }))
    : [];
}

function download(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ClassroomExperience() {
  const [surface, setSurface] = useState<AssignmentSurface>("play");
  const [target, setTarget] = useState("pd");
  const [persona, setPersona] = useState("tft");
  const [seed, setSeed] = useState(1234567);
  const [copyNotice, setCopyNotice] = useState("");

  const [submissions, setSubmissions] = useState<readonly ClassroomSubmission[]>([]);
  const [rejections, setRejections] = useState<readonly ClassroomRejection[]>([]);
  const [duplicates, setDuplicates] = useState<
    readonly { submission: ClassroomSubmission; kept: boolean }[]
  >([]);
  const digests = useRef(new Set<string>());
  const intakeGeneration = useRef(0);

  const assignmentPath = useMemo(() => {
    try {
      return buildAssignmentPath({
        surface,
        target,
        ...(surface === "play" ? { persona, seed } : {}),
      });
    } catch {
      return "";
    }
  }, [surface, target, persona, seed]);

  const assignmentUrl =
    typeof window !== "undefined" && assignmentPath
      ? `${window.location.origin}${assignmentPath}`
      : assignmentPath;

  const aggregate = useMemo(() => aggregateSubmissions(submissions), [submissions]);

  const targets = ASSIGNMENT_TARGETS[surface];
  const showPersona = surface === "play";
  const personas = showPersona ? personaOptions(target) : [];

  const handleSurface = (next: AssignmentSurface) => {
    setSurface(next);
    const firstTarget = ASSIGNMENT_TARGETS[next][0].value;
    setTarget(firstTarget);
    if (next === "play") {
      const options = personaOptions(firstTarget);
      if (options.length > 0) {
        setPersona(options[0].id);
      }
    }
  };

  const handleTarget = (next: string) => {
    setTarget(next);
    if (surface === "play") {
      const options = personaOptions(next);
      if (options.length > 0) {
        setPersona(options[0].id);
      }
    }
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(assignmentUrl);
        setCopyNotice("Assignment link copied.");
        return;
      }
    } catch {
      // Fall through to the manual-copy field below.
    }
    setCopyNotice("Copy the link from the field below.");
  };

  const ingestFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 100) {
      setRejections((current) => [
        ...current,
        { filename: "Selection", notice: "At most 100 files may be selected; none were read." },
      ]);
      return;
    }
    const generation = intakeGeneration.current;
    for (const file of files) {
      try {
        if (file.size > SESSION_FILE_BYTE_LIMIT)
          throw new Error("This file exceeds the 2 MiB intake limit.");
        const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(new Error("The file could not be read."));
          reader.onabort = () => reject(new Error("The file read was cancelled."));
          reader.readAsArrayBuffer(file);
        });
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        const result = ingestSessionFile(file.name, text);
        if (!result.ok) throw new Error(result.rejection.notice);
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
        if (generation !== intakeGeneration.current) return;
        if (digests.current.has(digest)) {
          setDuplicates((current) => [...current, { submission: result.submission, kept: false }]);
        } else {
          digests.current.add(digest);
          setSubmissions((current) => [...current, result.submission]);
        }
      } catch (error) {
        if (generation !== intakeGeneration.current) return;
        setRejections((current) => [
          ...current,
          {
            filename: file.name,
            notice: error instanceof Error ? error.message : "Import unavailable.",
          },
        ]);
      }
    }
  };

  const clearResults = () => {
    intakeGeneration.current += 1;
    digests.current.clear();
    setDuplicates([]);
    setSubmissions([]);
    setRejections([]);
  };

  return (
    <section aria-labelledby="classroom-title" className="classroom">
      <header className="classroom__header">
        <p className="eyebrow">Classroom / Teach with it</p>
        <h1 className="display" id="classroom-title">
          Run it with a class.
        </h1>
        <p className="lede">
          Build a link that pins one exercise for every student, then aggregate the sessions they
          download — all on your device, with nothing uploaded.
        </p>
      </header>

      <div className="classroom__layout">
        <section aria-labelledby="classroom-assign-title" className="classroom__panel">
          <h2 id="classroom-assign-title">1. Build an assignment link</h2>
          <form className="classroom__form" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>Exercise</span>
              <select
                onChange={(event) => handleSurface(event.target.value as AssignmentSurface)}
                value={surface}
              >
                {(Object.keys(SURFACE_LABEL) as AssignmentSurface[]).map((option) => (
                  <option key={option} value={option}>
                    {SURFACE_LABEL[option]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Game</span>
              <select onChange={(event) => handleTarget(event.target.value)} value={target}>
                {targets.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            {showPersona && personas.length > 0 ? (
              <label>
                <span>Rival</span>
                <select onChange={(event) => setPersona(event.target.value)} value={persona}>
                  {personas.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showPersona ? (
              <label>
                <span>Seed</span>
                <input
                  min={0}
                  onChange={(event) =>
                    setSeed(Math.max(0, Math.floor(Number(event.target.value)) || 0))
                  }
                  type="number"
                  value={seed}
                />
              </label>
            ) : null}
          </form>

          <div className="classroom__link">
            <label htmlFor="assignment-url">Assignment link</label>
            <input id="assignment-url" readOnly value={assignmentUrl} />
            <button className="analysis-button" onClick={copyLink} type="button">
              Copy link
            </button>
            <p aria-live="polite" className="classroom__notice" role="status">
              {copyNotice}
            </p>
          </div>
          {surface !== "play" ? (
            <p className="classroom__hint">
              Only Play assignments pin a specific rival and seed. Hot-seat and auction links open
              the exercise for students to explore.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="classroom-collect-title" className="classroom__panel">
          <h2 id="classroom-collect-title">2. Aggregate downloaded sessions</h2>
          <p className="classroom__help">
            Students download a session from any Play, hot-seat, or auction screen. Add those JSON
            files here; they are read locally and never uploaded. Arithmetic is verified, not human
            play or student identity. Intake limits: 100 files per selection, 2 MiB per file, 10,000
            rounds, 256 characters per rational and 16,384 bits per reduced exact value.
          </p>
          <label className="classroom__file">
            <span>Add session files</span>
            <input accept="application/json,.json" multiple onChange={ingestFiles} type="file" />
          </label>

          <p aria-live="polite" className="classroom__summary" role="status">
            {aggregate.count} session{aggregate.count === 1 ? "" : "s"} loaded across{" "}
            {aggregate.totalRounds} rounds.
          </p>

          {aggregate.byGame.length > 0 ? (
            <table className="classroom__table" data-testid="classroom-aggregate">
              <caption>
                Exact class means per exercise. Mixed round counts and metadata are disclosed; raw
                totals are not a controlled comparison. Per-round means pool payoffs over all played
                rounds.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Exercise</th>
                  <th scope="col">Sessions</th>
                  <th scope="col">Mean row total</th>
                  <th scope="col">Mean column total</th>
                  <th scope="col">Rounds / metadata</th>
                  <th scope="col">Row payoff per played round</th>
                  <th scope="col">Column payoff per played round</th>
                </tr>
              </thead>
              <tbody>
                {aggregate.byGame.map((summary) => (
                  <tr key={`${summary.kind}:${summary.game}`}>
                    <th scope="row">
                      {summary.title} <span className="classroom__kind">({summary.kind})</span>
                    </th>
                    <td>{summary.count}</td>
                    <td>
                      {summary.meanRowTotal ? formatRational(summary.meanRowTotal) : "Unavailable"}
                    </td>
                    <td>
                      {summary.meanColumnTotal
                        ? formatRational(summary.meanColumnTotal)
                        : "Unavailable"}
                    </td>
                    <td>
                      {summary.roundRange.join(" to ")} / {summary.metadata.join("; ")}
                      {summary.unavailable ? <p>{summary.unavailable}</p> : null}
                    </td>
                    <td>
                      {summary.meanRowPerRound
                        ? formatRational(summary.meanRowPerRound)
                        : "Unavailable"}
                    </td>
                    <td>
                      {summary.meanColumnPerRound
                        ? formatRational(summary.meanColumnPerRound)
                        : "Unavailable"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {duplicates.length > 0 ? (
            <div role="status">
              <p>
                {duplicates.filter((entry) => !entry.kept).length} exact duplicate file(s) skipped;{" "}
                {duplicates.filter((entry) => entry.kept).length} explicitly kept.
              </p>
              {duplicates.map((entry, index) => (
                <p key={index}>
                  {entry.submission.filename}: identical original file bytes.{" "}
                  {!entry.kept ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSubmissions((current) => [...current, entry.submission]);
                        setDuplicates((current) =>
                          current.map((item, i) => (i === index ? { ...item, kept: true } : item)),
                        );
                      }}
                    >
                      Keep duplicate {index + 1}
                    </button>
                  ) : (
                    "Kept as a separate submission."
                  )}
                </p>
              ))}
            </div>
          ) : null}

          {rejections.length > 0 ? (
            <div className="classroom__rejections" role="alert">
              <p>Skipped {rejections.length} file(s):</p>
              <ul>
                {rejections.map((rejection) => (
                  <li key={`${rejection.filename}:${rejections.indexOf(rejection)}`}>
                    {rejection.filename}: {rejection.notice}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {submissions.length > 0 ? (
            <div className="classroom__actions">
              <button
                className="analysis-button"
                onClick={() =>
                  download("class-results.csv", submissionsToCsv(submissions), "text/csv")
                }
                type="button"
              >
                Download CSV
              </button>
              <button className="hot-seat-export" onClick={clearResults} type="button">
                Clear
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
