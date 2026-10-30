import clsx from "clsx"

function RequirementBarTrack({
  percent,
  fillClassName,
  shortfall = false,
  className,
}: {
  percent: number
  fillClassName: string
  shortfall?: boolean
  className?: string
}) {
  return (
    <div className={clsx("relative h-1.5 overflow-hidden bg-elevated", className)} aria-hidden="true">
      <span
        className={clsx("block h-full", fillClassName)}
        style={{ width: `${percent}%` }}
        data-bar-fill
      />
      {shortfall && (
        <span
          className="absolute inset-y-0 right-0.5 w-0.5 bg-danger"
          data-shortfall-marker
        />
      )}
      <span className="absolute inset-y-0 right-0 w-px bg-primary/70" data-threshold-tick />
    </div>
  )
}

export { RequirementBarTrack }
