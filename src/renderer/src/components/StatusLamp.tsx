import { cn } from '@/lib/utils'

export type LampState = 'idle' | 'connecting' | 'live' | 'error'

export const STATE_LABEL: Record<LampState, string> = {
  idle: 'belum tersambung',
  connecting: 'menyambung',
  live: 'tersambung',
  error: 'gagal'
}

const COLOR: Record<LampState, string> = {
  idle: 'bg-ink-dim',
  connecting: 'bg-lamp-warn',
  live: 'bg-lamp-run',
  error: 'bg-lamp-error'
}

const GLOW: Record<LampState, string> = {
  idle: '',
  connecting: 'glow-warn',
  live: 'glow-run',
  error: 'glow-error'
}

/** the lit rail down the left edge of a rack unit */
export function StatusRail({ state }: { state: LampState }): JSX.Element {
  return (
    <span
      role="img"
      aria-label={STATE_LABEL[state]}
      title={STATE_LABEL[state]}
      className={cn(
        'w-[3px] self-stretch rounded-full shrink-0',
        COLOR[state],
        GLOW[state],
        state === 'connecting' && 'animate-breathe'
      )}
    />
  )
}

export function StatusDot({
  state,
  className
}: {
  state: LampState
  className?: string
}): JSX.Element {
  return (
    <span
      className={cn(
        'h-1.5 w-1.5 rounded-full shrink-0',
        COLOR[state],
        GLOW[state],
        state === 'connecting' && 'animate-breathe',
        className
      )}
    />
  )
}
