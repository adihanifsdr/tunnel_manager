import { Play, Square, Radio } from 'lucide-react'
import type { TunnelTarget, TunnelState } from '../../../shared/types'
import { cn } from '@/lib/utils'
import { serviceIcon } from '@/lib/service-icon'
import { StatusRail, type LampState } from './StatusLamp'
import { PortMap, LOCAL_SLOT } from './PortMap'

interface Props {
  target: TunnelTarget
  tunnel: TunnelState | undefined
  connecting: boolean
  error: string | undefined
  isGateway: boolean
  selected: boolean
  /** remote port being edited for this target */
  port: string
  onPortChange: (port: string) => void
  onSelect: () => void
  onConnect: (remotePort: number) => void
  onDisconnect: () => void
}

export function TargetRow({
  target,
  tunnel,
  connecting,
  error,
  isGateway,
  selected,
  port,
  onPortChange,
  onSelect,
  onConnect,
  onDisconnect
}: Props): JSX.Element {
  const parsed = parseInt(port, 10)
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 65535
  const live = tunnel?.active ?? false

  const state: LampState = live ? 'live' : connecting ? 'connecting' : error ? 'error' : 'idle'
  const Icon = serviceIcon(`${target.name} ${target.image}`)

  const context =
    target.kind === 'render'
      ? [target.image, target.privateHost, target.status].filter(Boolean).join(' · ')
      : [
          target.image.split('/').pop()?.slice(0, 34) ?? target.image,
          target.ports.length ? target.ports.map((p) => p.port).join(', ') : 'tanpa port',
          target.status.slice(0, 28)
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group rounded-md border bg-surface transition-colors',
        selected ? 'border-accent/60 bg-surface2' : 'border-line hover:border-line-strong'
      )}
    >
      <div className="flex items-stretch gap-3 py-2 pl-2 pr-2">
        <StatusRail state={state} />

        {/* the port slot keeps its geometry whether or not a tunnel exists, so
            nothing shifts when one opens */}
        <div className="flex w-[124px] shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          {live && tunnel ? (
            <PortMap local={tunnel.localPort} remote={tunnel.remotePort} />
          ) : (
            <div className="flex items-baseline gap-1.5 font-mono leading-none">
              <span className={cn('text-right text-[13px] text-ink-dim', LOCAL_SLOT)}>—</span>
              <span className="text-[10px] text-ink-dim">→</span>
              <input
                value={port}
                onChange={(e) => onPortChange(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && valid && !connecting) onConnect(parsed)
                }}
                placeholder="port"
                inputMode="numeric"
                aria-label={`Port remote ${target.name}`}
                className="w-[6ch] rounded border border-line bg-chassis px-1 py-0.5 text-center text-[11px] text-steel placeholder:text-ink-dim focus:border-accent focus:outline-none"
              />
            </div>
          )}
        </div>

        <Icon size={15} className="mt-[3px] shrink-0 text-ink-dim" />

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate text-[13px]', live ? 'text-ink' : 'text-ink-muted')}>
              {target.name}
            </span>
            {isGateway && (
              <span
                className="flex shrink-0 items-center gap-1 rounded border border-accent/40 px-1 font-mono text-[9px] uppercase tracking-wider text-accent"
                title="Sesi SSH untuk mode Render lewat service ini"
              >
                <Radio size={9} /> gateway
              </span>
            )}
          </div>
          <div
            className={cn(
              'truncate font-mono text-[10px]',
              error ? 'text-lamp-error/80' : 'text-ink-dim'
            )}
          >
            {error ?? context}
          </div>
        </div>

        <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          {live ? (
            <button
              onClick={onDisconnect}
              className="rounded p-1.5 text-ink-muted transition-colors hover:bg-lamp-error/10 hover:text-lamp-error"
              title="Putuskan"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              onClick={() => valid && onConnect(parsed)}
              disabled={!valid || connecting}
              className="rounded p-1.5 text-ink-muted transition-colors hover:bg-lamp-run/10 hover:text-lamp-run disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
              title={valid ? 'Sambungkan' : 'Isi port remote dulu'}
            >
              <Play size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
