'use client';

export function ScoreRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 75 ? 'var(--good)' : pct >= 55 ? 'var(--gold)' : 'var(--crit)';

  return (
    <div
      className="score-ring"
      style={{ ['--pct' as string]: pct, ['--ring-color' as string]: color }}
      role="img"
      aria-label={`Score ${pct} out of 100`}
    >
      <div className="score-ring-inner">{pct}</div>
    </div>
  );
}
