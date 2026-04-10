type OverviewCardProps = {
  eyebrow: string;
  title: string;
  value: string | number;
  note: string;
};

export function EvmOverviewCard({ eyebrow, title, value, note }: OverviewCardProps) {
  return (
    <article className="surface-card">
      <span className="kicker">{eyebrow}</span>
      <h2>{title}</h2>
      <p className="metric-value">{value}</p>
      <p className="panel-note">{note}</p>
    </article>
  );
}
