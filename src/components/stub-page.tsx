type StubPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
};

export function StubPage({ eyebrow, title, summary }: StubPageProps) {
  return (
    <section className="stub" aria-labelledby="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display" id="page-title">
        {title}
      </h1>
      <p className="lede">{summary}</p>
      <div className="stub__panel">
        <p>
          This route is part of the P0 static shell. The interactive system is
          intentionally introduced in later build phases.
        </p>
      </div>
    </section>
  );
}
