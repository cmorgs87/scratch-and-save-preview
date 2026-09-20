type LifetimeStatusProgressBarProps = {
  progress: number;
  label: string;
  className?: string;
};

export function LifetimeStatusProgressBar({
  progress,
  label,
  className = "",
}: LifetimeStatusProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const width = clamped <= 0 ? "0%" : `${clamped * 100}%`;

  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--teal),#8b5cf6)] shadow-[0_0_16px_rgba(86,230,213,0.28)] transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width }}
      />
    </div>
  );
}
