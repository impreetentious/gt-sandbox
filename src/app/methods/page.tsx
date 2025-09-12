import type { Metadata } from "next";
import { ZeroDeterminantDemo } from "@/components/methods/zd-demo";
import { zdContent } from "@/content/zd";

export const metadata: Metadata = {
  title: "Methods",
  description:
    "How exact arithmetic, independent verification, external fixtures, seeded simulation, and browser checks support every result in the sandbox.",
};

const verificationLayers = [
  {
    title: "Human oracles",
    body: "Each canonical game carries theory-derived expected properties: pure and mixed equilibria, dominance, efficiency, strategic structure, and nondegeneracy.",
  },
  {
    title: "Independent verification",
    body: "A separate code path checks every candidate equilibrium against exact best-response conditions. Randomized properties compare the solver with brute force where that comparison is available.",
  },
  {
    title: "External cross-oracle",
    body: "A committed 39-case corpus was generated with Gambit 16.3.0 in an isolated, pinned environment. The repository verifies the corpus digest and exact equilibrium sets without requiring Gambit at runtime.",
  },
  {
    title: "Closed-form cross-check",
    body: "Random nondegenerate 2×2 games are solved both by support enumeration and by a separate closed-form implementation.",
  },
  {
    title: "Frozen simulation fixtures",
    body: "Stochastic matches are event-addressed by seed. Tournament matrices and evolution stories are pinned as reviewed fixtures, then regenerated in tests.",
  },
  {
    title: "Exported-browser acceptance",
    body: "The same static files that ship are crawled in Chromium for keyboard operation, accessibility, reduced motion, responsive reflow, CSP behavior, and the no-off-origin-request boundary.",
  },
] as const;

export default function MethodsPage() {
  return (
    <article className="methods">
      <header className="methods__hero">
        <p className="eyebrow">Methods / Inspectable confidence</p>
        <h1 className="display">Correctness is the product.</h1>
        <p className="lede">
          The interface is allowed to be inviting because the claims underneath
          it are deliberately hard to fake: exact arithmetic, disjoint checks,
          frozen evidence, and an honest boundary around what v1 can prove.
        </p>
      </header>

      <section
        aria-labelledby="scope-title"
        className="methods__section methods__scope"
      >
        <div>
          <p className="eyebrow">Scope</p>
          <h2 id="scope-title">Finite two-player normal-form games.</h2>
        </div>
        <div>
          <p>
            The solver accepts two to four actions per player and represents
            every payoff and equilibrium probability as a normalized bigint
            fraction. Floating point does not enter an equilibrium or
            best-response correctness path.
          </p>
          <p>
            Equal-size support enumeration returns all equilibria of a
            nondegenerate bimatrix game within that bound. Degenerate games can
            contain equilibrium components; the engine detects an exact
            support-size witness, reports pure equilibria and verified mixed
            samples, and does not call that sample complete.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="verification-title"
        className="methods__section"
      >
        <div className="methods__section-heading">
          <p className="eyebrow">Verification spine</p>
          <h2 id="verification-title">Six layers that fail differently.</h2>
          <p>
            Agreement matters most when the implementations and evidence do not
            share the same likely mistake.
          </p>
        </div>
        <ol className="methods__layers">
          {verificationLayers.map((layer, index) => (
            <li key={layer.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{layer.title}</h3>
                <p>{layer.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="simulation-title"
        className="methods__section methods__split"
      >
        <div>
          <p className="eyebrow">Simulation boundary</p>
          <h2 id="simulation-title">Reproducible, not relabelled as proof.</h2>
        </div>
        <div>
          <p>
            Match length, policy decisions, and action noise each receive an
            event-addressed stream derived from the master seed. Changing one
            policy therefore does not silently shift an opponent&apos;s future
            random draws.
          </p>
          <p>
            Evolution shares use guarded floating-point replicator updates.
            Those shares are simulation state, not solver claims. A zero or
            non-finite mean-fitness denominator returns a typed failure before
            division.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="zd-title"
        className="methods__section methods__zd"
      >
        <div>
          <p className="eyebrow">Worked demonstration</p>
          <h2 id="zd-title">One player can fix the scoreboard.</h2>
        </div>
        <div>
          <p>{zdContent.framing}</p>
          <p>{zdContent.exactness}</p>
          <ZeroDeterminantDemo />
        </div>
      </section>

      <section
        aria-labelledby="privacy-title"
        className="methods__section methods__privacy"
      >
        <div>
          <p className="eyebrow">Privacy and state</p>
          <h2 id="privacy-title">Static and quiet by construction.</h2>
        </div>
        <div>
          <ul>
            <li>
              No account, backend, analytics, cookies, telemetry, or runtime API
              calls.
            </li>
            <li>
              Initial loads and navigation request only same-origin static
              documents, scripts, styles, images, and build-emitted route data.
            </li>
            <li>
              A Build link can encode its bounded title, action labels, exact
              payoffs, persona, seed, continuation probability, and noise. Read
              the URL before sharing it if those labels are sensitive.
            </li>
            <li>
              Local storage contains one optional key,{" "}
              <code>seenOnboarding</code>, solely to hide the first-visit hint
              after dismissal.
            </li>
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="prior-art-title"
        className="methods__section methods__references"
      >
        <div className="methods__section-heading">
          <p className="eyebrow">References and prior art</p>
          <h2 id="prior-art-title">Built in a visible lineage.</h2>
        </div>
        <div className="methods__reference-grid">
          <section>
            <h3>Definitions and selection</h3>
            <p>
              Martin J. Osborne, <cite>An Introduction to Game Theory</cite>;
              John Harsanyi and Reinhard Selten,{" "}
              <cite>A General Theory of Equilibrium Selection in Games</cite>.
            </p>
          </section>
          <section>
            <h3>Repeated play and evolution</h3>
            <p>
              Robert Axelrod, <cite>The Evolution of Cooperation</cite>; Martin
              Nowak, “Five Rules for the Evolution of Cooperation”; Josef
              Hofbauer and Karl Sigmund,{" "}
              <cite>Evolutionary Games and Population Dynamics</cite>.
            </p>
          </section>
          <section>
            <h3>Independent computation</h3>
            <p>
              <a href="https://gambitproject.readthedocs.io/en/latest/">
                Gambit 16.3.0
              </a>{" "}
              provides the external equilibrium corpus. Its fixture inputs,
              output, manifest, and digest are committed in the repository.
            </p>
          </section>
          <section>
            <h3>Interaction benchmark</h3>
            <p>
              Nicky Case&apos;s 2017{" "}
              <a href="https://ncase.me/trust/">
                <cite>The Evolution of Trust</cite>
              </a>{" "}
              remains the benchmark linear explorable for repeated cooperation.
              This sandbox complements it with editable games and a live exact
              analytical engine.
            </p>
          </section>
        </div>
      </section>
    </article>
  );
}
