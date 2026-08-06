import { useEffect, useState } from 'react'
import { Play, Square, Copy, Check, Radio } from 'lucide-react'
import type { TunnelTarget, TunnelState } from '../../../shared/types'
import { cn } from '@/lib/utils'
import { serviceIcon } from '@/lib/service-icon'
import { PortMap } from './PortMap'
import { StatusDot, STATE_LABEL, type LampState } from './StatusLamp'

interface Props {
  target: TunnelTarget | null
  tunnel: TunnelState | undefined
  connecting: boolean
  error: string | undefined
  port: string
  isRender: boolean
  gateway: TunnelTarget | null
  targets: TunnelTarget[]
  onGatewayChange: (id: string) => void
  onConnect: () => void
  onDisconnect: () => void
}

export function DetailPanel({
  target,
  tunnel,
  connecting,
  error,
  port,
  isRender,
  gateway,
  targets,
  onGatewayChange,
  onConnect,
  onDisconnect
}: Props): JSX.Element {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return (): void => clearTimeout(timer)
  }, [copied])

  if (!target) {
    return (
      <section className="flex h-full min-h-0 flex-col items-start justify-center rounded-md border border-line bg-surface px-6">
        <h2 className="text-[15px] text-ink">Belum ada target dipilih</h2>
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-ink-muted">
          Scan dulu, lalu pilih satu baris untuk melihat pemetaan portnya dan menyalin alamat
          localhost yang siap ditempel ke client.
        </p>
      </section>
    )
  }

  const live = tunnel?.active ?? false
  const state: LampState = live ? 'live' : connecting ? 'connecting' : error ? 'error' : 'idle'
  const Icon = serviceIcon(`${target.name} ${target.image}`)
  const address = tunnel ? `localhost:${tunnel.localPort}` : null
  const farSide = target.privateHost ?? target.name

  const copy = (): void => {
    if (!address) return
    void navigator.clipboard.writeText(address).then(() => setCopied(true))
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto rounded-md border border-line bg-surface">
      <header className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-start gap-3">
          <Icon size={18} className="mt-0.5 shrink-0 text-ink-dim" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] text-ink">{target.name}</h2>
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-ink-dim">
              <StatusDot state={state} />
              <span className="uppercase tracking-wider">{STATE_LABEL[state]}</span>
              <span>·</span>
              <span className="truncate">{target.image}</span>
            </div>
          </div>
          <button
            onClick={live ? onDisconnect : onConnect}
            disabled={!live && connecting}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-colors',
              live
                ? 'border-line-strong text-ink-muted hover:border-lamp-error/50 hover:text-lamp-error'
                : 'border-lamp-run/40 bg-lamp-run/10 text-lamp-run hover:bg-lamp-run/20 disabled:opacity-35'
            )}
          >
            {live ? <Square size={12} /> : <Play size={12} />}
            {live ? 'Putuskan' : 'Sambungkan'}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {/* the reason this panel exists: the address you copy out of the app */}
        <div className="rounded-md border border-line bg-chassis p-4">
          <span className="eyebrow">pemetaan</span>
          <div className="mt-2 flex items-end justify-between gap-4">
            <PortMap
              local={tunnel?.localPort ?? null}
              remote={tunnel?.remotePort ?? (port || '—')}
              size="lg"
            />
            <button
              onClick={copy}
              disabled={!address}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1.5 text-[11px] text-ink-muted transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-ink-muted"
              title={address ? `Salin ${address}` : 'Sambungkan dulu untuk dapat port lokal'}
            >
              {copied ? <Check size={12} className="text-lamp-run" /> : <Copy size={12} />}
              {copied ? 'Tersalin' : 'Salin alamat'}
            </button>
          </div>
          <p className="mt-3 font-mono text-[11px] text-ink-dim">
            {address ? (
              <>
                <span className="text-ink">{address}</span>
                {' → '}
                {farSide}:{tunnel?.remotePort}
                {isRender && gateway ? ` (lewat ${gateway.name})` : ''}
              </>
            ) : (
              `belum tersambung — akan diarahkan ke ${farSide}:${port || '?'}`
            )}
          </p>
        </div>

        {target.status && (
          <div>
            <span className="eyebrow">status</span>
            <p className="mt-1 font-mono text-[11px] text-ink-muted">{target.status}</p>
          </div>
        )}

        {isRender && (
          <div className="rounded-md border border-line p-3">
            <span className="eyebrow flex items-center gap-1.5">
              <Radio size={11} /> gateway
            </span>
            <select
              value={gateway?.id ?? ''}
              onChange={(e) => onGatewayChange(e.target.value)}
              className="mt-2 w-full rounded border border-line bg-chassis px-2 py-1.5 text-[12px] text-ink focus:border-accent focus:outline-none"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.image})
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">
              Shell SSH Render adalah salinan baru dari image tanpa start command, jadi service yang
              dituju tidak pernah hidup di dalam shell-nya sendiri. Tunnel harus lewat service lain
              yang sanggup menampung sesi — web service atau worker, bukan image datastore.
            </p>
          </div>
        )}

        {error && (
          <div>
            <span className="eyebrow text-lamp-error">gagal</span>
            <p className="mt-1 select-text whitespace-pre-wrap break-words rounded border border-lamp-error/25 bg-lamp-error/10 p-2.5 font-mono text-[11px] text-lamp-error">
              {error}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
