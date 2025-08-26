"use client";

import { useId, useState } from "react";
import { glossary, type GlossaryTermId } from "@/content/glossary";

interface GlossaryTermProps {
  readonly term: GlossaryTermId;
  readonly children?: string;
}

/** An inline, keyboard-operable definition disclosed on demand. */
export function GlossaryTerm({ term, children }: GlossaryTermProps) {
  const definition = glossary[term];
  const [open, setOpen] = useState(false);
  const definitionId = useId();

  return (
    <span className="glossary-term">
      <button
        aria-controls={definitionId}
        aria-describedby={open ? definitionId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((expanded) => !expanded)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        type="button"
      >
        {children ?? definition.label}
      </button>
      {open ? (
        <span
          className="glossary-term__definition"
          id={definitionId}
          role="tooltip"
        >
          {definition.definition}
        </span>
      ) : null}
    </span>
  );
}
