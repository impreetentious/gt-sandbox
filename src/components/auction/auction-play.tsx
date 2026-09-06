"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import { auctionFormatContent } from "@/content/auctions";
import {
  auctionPersonas,
  bestResponseBid,
  firstPriceBenchmarkBid,
  type AuctionFormat,
} from "@/engine/auction/auction";
import { analyzeCommonValue } from "@/engine/auction/common-value";
import { analyzeSecondPriceDominance } from "@/engine/auction/second-price";
import { formatRational } from "@/engine/rational";
import {
  auctionPersonasForFormat,
  auctionSessionToExport,
  createAuctionSession,
  reduceAuctionSession,
} from "@/state/auction-session";
import { serializeSessionExport } from "@/state/session-export";

function FirstPriceReveal({ persona }: { readonly persona: string }) {
  const benchmark = firstPriceBenchmarkBid(8);
  const best = bestResponseBid({
    format: "first-price",
    yourValue: 8,
    maxValue: 10,
    rivalBid: auctionPersonas.shader.bid,
  });
  return (
    <div className="auction-reveal">
      <h3>Why shade your bid</h3>
      <p>
        Bidding your full valuation guarantees zero profit: if you win, you pay exactly what the
        item was worth. The risk-neutral symmetric benchmark for two bidders with uniform valuations
        is to bid half your value — for a valuation of 8 that benchmark bid is{" "}
        <strong>{formatRational(benchmark)}</strong>.
      </p>
      <p>
        Against a shading rival, the exact best-response bid at valuation 8 is{" "}
        <strong>{best.bid}</strong>, earning an expected{" "}
        <strong>{formatRational(best.payoff)}</strong>. The rival persona is {persona}.
      </p>
      <p className="auction-reveal__note">
        The half-value figure is the continuous-uniform benchmark, labelled as such — not a claim
        about the exact discrete-grid equilibrium.
      </p>
    </div>
  );
}

function SecondPriceReveal() {
  const dominance = analyzeSecondPriceDominance(10);
  return (
    <div className="auction-reveal">
      <h3>Why truthful bidding is dominant</h3>
      <p>
        The engine checks every valuation, every alternative bid, and every rival bid on the grid.
        Bidding your valuation is{" "}
        <strong>{dominance.weaklyDominant ? "weakly dominant" : "not dominant"}</strong>: it never
        does worse, and sometimes strictly better.
      </p>
      {dominance.overbidWitness ? (
        <p>
          Overbidding can backfire. At valuation {dominance.overbidWitness.value}, bidding{" "}
          {dominance.overbidWitness.alternativeBid} against a rival bid of{" "}
          {dominance.overbidWitness.rivalBid} earns{" "}
          <strong>{formatRational(dominance.overbidWitness.alternativePayoff)}</strong> — versus{" "}
          {formatRational(dominance.overbidWitness.truthfulPayoff)} for the truthful bid. You can
          win at a loss.
        </p>
      ) : null}
      {dominance.underbidWitness ? (
        <p>
          Underbidding only costs you wins you would have wanted: at valuation{" "}
          {dominance.underbidWitness.value}, bidding {dominance.underbidWitness.alternativeBid}{" "}
          forfeits a {formatRational(dominance.underbidWitness.truthfulPayoff)} profit.
        </p>
      ) : null}
    </div>
  );
}

function CommonValueReveal() {
  const analysis = analyzeCommonValue(10);
  const rows = analysis.rows.filter((row) => row.signal >= 3 && row.signal <= 8);
  return (
    <div className="auction-reveal">
      <h3>
        The <GlossaryTerm term="winners-curse" />
      </h3>
      <p>
        Bidding your own signal loses money on average: the exact expected profit is{" "}
        <strong>{formatRational(analysis.expectedNaiveProfit)}</strong>. Winning is bad news — it
        means your signal was probably the higher one.
      </p>
      <table className="auction-curse-table">
        <caption>
          For each signal: your face-value estimate of the common value, versus the exact expected
          value once you condition on winning.
        </caption>
        <thead>
          <tr>
            <th scope="col">Signal</th>
            <th scope="col">Naive estimate</th>
            <th scope="col">Given you win</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.signal}>
              <th scope="row">{row.signal}</th>
              <td>{formatRational(row.naiveEstimate)}</td>
              <td>{formatRational(row.winningEstimate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuctionPlayExperience({ format }: { readonly format: AuctionFormat }) {
  const content = auctionFormatContent[format];
  const personas = auctionPersonasForFormat(format);
  const [state, dispatch] = useReducer(reduceAuctionSession, format, (initial) =>
    createAuctionSession(initial),
  );
  const [bid, setBid] = useState(0);

  const bidRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    switch (state.focusTarget) {
      case "bid":
        bidRef.current?.focus();
        break;
      case "continue":
        continueRef.current?.focus();
        break;
      case "restart":
        restartRef.current?.focus();
        break;
    }
  }, [state.focusTarget, state.rounds.length, state.status]);

  const latest = state.pending ?? state.rounds.at(-1);

  const narration =
    state.status === "revealed" && latest
      ? `You bid ${latest.yourBid}; the rival bid ${latest.rivalBid}. ${latest.youWin ? `You won and earned ${formatRational(latest.yourPayoff)}.` : "You did not win this round."}`
      : state.status === "complete"
        ? `Session complete. Total profit ${formatRational(state.yourProfit)}.`
        : `Round ${state.rounds.length + 1} of ${state.roundLimit}. ${content.observationLabel} is ${state.current.yourObservation}. Choose a bid.`;

  const downloadExport = () => {
    const json = serializeSessionExport(auctionSessionToExport(state, content.title));
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `auction-${format}-session.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="auction-title" className="auction" data-format={format}>
      <header className="auction__header">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 className="display" id="auction-title">
          {content.title}
        </h1>
        <p className="lede">{content.framing}</p>
      </header>

      <div className="auction__scoreboard" aria-label="Session profit">
        <p>
          <span>Your profit</span>
          <strong>{formatRational(state.yourProfit)}</strong>
        </p>
        <p>
          <span>Round</span>
          <strong>
            {Math.min(state.rounds.length + 1, state.roundLimit)} / {state.roundLimit}
          </strong>
        </p>
        <p>
          <span>Rival</span>
          <strong>{auctionPersonas[state.persona].name}</strong>
        </p>
      </div>

      <div className="auction__layout">
        <section aria-labelledby="auction-arena" className="auction__arena">
          <h2 id="auction-arena">Act</h2>

          <label className="auction__persona-select">
            <span>Rival</span>
            <select
              disabled={state.rounds.length > 0 || state.status !== "bidding"}
              onChange={(event) =>
                dispatch({
                  type: "select-persona",
                  persona: event.target.value as typeof state.persona,
                })
              }
              value={state.persona}
            >
              {personas.map((id) => (
                <option key={id} value={id}>
                  {auctionPersonas[id].name}
                </option>
              ))}
            </select>
          </label>

          <p className="auction__observation" data-testid="auction-observation">
            {content.observationLabel}: <strong>{state.current.yourObservation}</strong>
          </p>
          <p className="auction__help">{content.observationHelp}</p>

          {state.status !== "complete" ? (
            <div className="auction__bid">
              <label htmlFor="auction-bid-input">Your bid ({bid})</label>
              <input
                disabled={state.status !== "bidding"}
                id="auction-bid-input"
                max={state.maxValue + 1}
                min={0}
                onChange={(event) => setBid(Number(event.target.value))}
                ref={bidRef}
                step={1}
                type="range"
                value={bid}
              />
              <button
                className="one-shot-play-again"
                disabled={state.status !== "bidding"}
                onClick={() => dispatch({ type: "submit-bid", bid })}
                type="button"
              >
                Submit bid
              </button>
            </div>
          ) : null}

          {state.status === "revealed" && latest ? (
            <div className="auction__result" data-testid="auction-result">
              <p>
                You bid <strong>{latest.yourBid}</strong>; the rival bid{" "}
                <strong>{latest.rivalBid}</strong>.
              </p>
              {latest.commonValue !== undefined ? (
                <p>
                  The item&apos;s true value was <strong>{latest.commonValue}</strong>.
                </p>
              ) : null}
              <p className="auction__result-line">
                {latest.youWin
                  ? `You won, paid ${formatRational(latest.price)}, and earned ${formatRational(latest.yourPayoff)}.`
                  : "You did not win this round."}
              </p>
              <button
                className="one-shot-play-again"
                onClick={() => dispatch({ type: "continue" })}
                ref={continueRef}
                type="button"
              >
                {state.rounds.length + 1 === state.roundLimit ? "Finish session" : "Next round"}
              </button>
            </div>
          ) : null}

          <p aria-live="polite" className="sr-only" role="status">
            {narration}
          </p>

          <section aria-labelledby="auction-history" className="auction__history">
            <h3 id="auction-history">History</h3>
            {state.rounds.length === 0 ? (
              <p>No auctions completed yet.</p>
            ) : (
              <ol tabIndex={0} aria-label="Completed auctions">
                {state.rounds.map((round) => (
                  <li key={round.number}>
                    <span>Round {round.number}</span>
                    <span>
                      you bid {round.yourBid}; rival {round.rivalBid}
                    </span>
                    <strong>{round.youWin ? `+${formatRational(round.yourPayoff)}` : "0"}</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {state.status === "complete" ? (
            <div className="one-shot-post-session" id="post-session-controls">
              <p>Total profit: {formatRational(state.yourProfit)}.</p>
              <div className="hot-seat-post-actions">
                <button
                  className="one-shot-play-again"
                  onClick={() => dispatch({ type: "restart" })}
                  ref={restartRef}
                  type="button"
                >
                  Play again
                </button>
                <button className="hot-seat-export" onClick={downloadExport} type="button">
                  Download session
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside aria-labelledby="auction-analysis" className="auction__analysis">
          <h2 id="auction-analysis">Reveal</h2>
          <p className="auction__concept">
            Concept: <strong>{content.concept}</strong>.
          </p>
          {format === "first-price" ? (
            <FirstPriceReveal persona={auctionPersonas[state.persona].name} />
          ) : null}
          {format === "second-price" ? <SecondPriceReveal /> : null}
          {format === "common-value" ? <CommonValueReveal /> : null}
          <p className="auction__personas">
            Rivals available: {personas.map((id) => auctionPersonas[id].name).join(", ")}.
          </p>
        </aside>
      </div>
    </section>
  );
}
