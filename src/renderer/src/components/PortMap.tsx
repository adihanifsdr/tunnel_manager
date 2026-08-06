import { cn } from '@/lib/utils'

/**
 * A patch-panel column: the local port loud and right-aligned so digits line up
 * down the list, the remote port quiet on the other side of the run.
 *
 * The local number is what gets pasted into a database client, so it outranks
 * the target's name. Before a tunnel exists there is no local port yet — the
 * slot holds an em dash rather than collapsing, so nothing shifts when one opens.
 */
export const LOCAL_SLOT = 'w-[5ch]'
export const REMOTE_SLOT = 'w-[5ch]'

interface Props {
  local: number | null
  remote: number | string
  size?: 'sm' | 'lg'
  className?: string
}

export function PortMap({ local, remote, size = 'sm', className }: Props): JSX.Element {
  const lg = size === 'lg'
  return (
    <div className={cn('flex items-baseline gap-1.5 font-mono leading-none', className)}>
      <span
        className={cn(
          'text-right tabular-nums',
          lg ? 'text-[22px] w-[5.5ch]' : `text-[13px] ${LOCAL_SLOT}`,
          local === null ? 'text-ink-dim' : 'text-ink'
        )}
      >
        {local ?? '—'}
      </span>
      <span className={cn('text-ink-dim', lg ? 'text-sm' : 'text-[10px]')}>→</span>
      <span className={cn('text-steel tabular-nums', lg ? 'text-sm' : 'text-[10px]')}>
        {remote}
      </span>
    </div>
  )
}

/** legend shown once above the list, so the two columns never need re-explaining */
export function PortMapLegend(): JSX.Element {
  return (
    <span className="flex items-baseline gap-1.5 font-mono text-[10px] leading-none">
      <span className="uppercase tracking-wider text-ink-muted">local</span>
      <span className="text-ink-dim">→</span>
      <span className="uppercase tracking-wider text-steel">remote</span>
    </span>
  )
}
