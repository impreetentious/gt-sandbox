import type { Metadata } from "next";
import Link from "next/link";
import { CurriculumPath } from "@/components/learn/curriculum-path";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "A ten-stop path through the sandbox, ordered so each idea needs the previous one. The gate is optional and comes off with one checkbox.",
};

export default function LearnPage() {
  return (
    <article className="learn">
      <header className="learn__hero">
        <p className="eyebrow">Learn / An order, if you want one</p>
        <h1 className="display">Ten stops, in the order they build.</h1>
        <p className="lede">
          The home page is an arc you can enter anywhere. This is the same
          material with a sequence attached, for when a sequence is what you
          want. Each stop carries exactly one idea and needs the one before it.
        </p>
        <p>
          Stops unlock as you go. That is a default, not a rule — the checkbox
          below opens all ten immediately, and every surface here is also one
          click away from <Link href="/">the home arc</Link>, which has never
          gated anything.
        </p>
      </header>

      <CurriculumPath />

      <section aria-labelledby="learn-state-title" className="learn__note">
        <div>
          <p className="eyebrow">What is stored</p>
          <h2 id="learn-state-title">One key, on this device.</h2>
        </div>
        <div>
          <p>
            Progress lives in a single <code>curriculum</code> entry in this
            browser&apos;s local storage: which stops you marked done, and
            whether the gate is on. Nothing is sent anywhere, there is no
            account, and clearing it with the button above removes the key
            outright rather than blanking it.
          </p>
        </div>
      </section>
    </article>
  );
}
