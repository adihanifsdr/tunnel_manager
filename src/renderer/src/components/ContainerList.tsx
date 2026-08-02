import { useState, useMemo } from 'react'
import { Filter } from 'lucide-react'
import { ContainerRow } from './ContainerRow'
import type { AppMode, TunnelTarget, TunnelState } from '../../../shared/types'

interface StatusMessage {
  text: string
  type: 'success' | 'error' | 'warning' | 'idle'
}

interface ContainerListProps {
  targets: TunnelTarget[]
  tunnels: Map<string, TunnelState>
  status: StatusMessage
  mode: AppMode
  viaId: string | null
  onViaChange: (id: string) => void
  onStartTunnel: (targetId: string, remotePort: number) => void
  onStopTunnel: (targetId: string) => void
}

export function ContainerList({
  targets,
  tunnels,
  status,
  mode,
  viaId,
  onViaChange,
  onStartTunnel,
  onStopTunnel
}: ContainerListProps): JSX.Element {
  const [filter, setFilter] = useState('')
  const isRender = mode === 'render'
  const noun = isRender ? 'services' : 'containers'

  const filtered = useMemo(() => {
    if (!filter.trim()) return targets
    const q = filter.toLowerCase()
    return targets.filter(
      (t) => t.name.toLowerCase().includes(q) || t.image.toLowerCase().includes(q)
    )
  }, [targets, filter])

  const statusColor = {
    success: 'text-success',
    error: 'text-destructive',
    warning: 'text-warning',
    idle: 'text-muted-foreground'
  }[status.type]

  return (
    <div className="bg-card rounded-lg flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-3">
        <h2 className="text-sm font-semibold shrink-0 capitalize">{noun}</h2>
        {targets.length > 0 && (
          <div className="flex items-center gap-1.5 flex-1 max-w-xs">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or type..."
              className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
        <span className={`text-xs shrink-0 ${statusColor}`}>
          {status.text}
          {filter.trim() && targets.length > 0 && ` (${filtered.length}/${targets.length})`}
        </span>
      </div>

      {/*
        Render tunnels run *through* a service, not *into* the one being reached:
        the SSH shell is a fresh copy of the image with the start command not
        run, so the service you want is never listening inside its own shell.
        Pick one that can hold a session — a web service or worker, not a
        datastore image.
      */}
      {isRender && targets.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="text-xs text-muted-foreground shrink-0">Tunnel via:</span>
          <select
            value={viaId ?? ''}
            onChange={(e) => onViaChange(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.image})
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground truncate">
            a datastore image usually cannot host the session — use a web service or worker
          </span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No {noun} found.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No {noun} matching &ldquo;{filter}&rdquo;
          </p>
        ) : (
          filtered.map((t) => {
            const tunnel = tunnels.get(t.id)
            return (
              <ContainerRow
                key={t.id}
                target={t}
                tunnelLocalPort={tunnel?.localPort ?? null}
                tunneling={tunnel?.active ?? false}
                onStartTunnel={onStartTunnel}
                onStopTunnel={onStopTunnel}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
