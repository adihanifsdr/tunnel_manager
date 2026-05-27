import { useState, useMemo } from 'react'
import { Filter } from 'lucide-react'
import { ContainerRow } from './ContainerRow'
import type { ContainerInfo, TunnelState } from '../../../shared/types'

interface StatusMessage {
  text: string
  type: 'success' | 'error' | 'warning' | 'idle'
}

interface ContainerListProps {
  containers: ContainerInfo[]
  tunnels: Map<string, TunnelState>
  status: StatusMessage
  onStartTunnel: (containerId: string, remotePort: number) => void
  onStopTunnel: (containerId: string) => void
}

export function ContainerList({
  containers,
  tunnels,
  status,
  onStartTunnel,
  onStopTunnel
}: ContainerListProps) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter.trim()) return containers
    const q = filter.toLowerCase()
    return containers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q)
    )
  }, [containers, filter])

  const statusColor = {
    success: 'text-success',
    error: 'text-destructive',
    warning: 'text-warning',
    idle: 'text-muted-foreground'
  }[status.type]

  return (
    <div className="bg-card rounded-lg flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-3">
        <h2 className="text-sm font-semibold shrink-0">Containers</h2>
        {containers.length > 0 && (
          <div className="flex items-center gap-1.5 flex-1 max-w-xs">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or image..."
              className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
        <span className={`text-xs shrink-0 ${statusColor}`}>
          {status.text}
          {filter.trim() && containers.length > 0 && ` (${filtered.length}/${containers.length})`}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {containers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No containers found.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No containers matching &ldquo;{filter}&rdquo;
          </p>
        ) : (
          filtered.map((c) => {
            const tunnel = tunnels.get(c.containerId)
            return (
              <ContainerRow
                key={c.containerId}
                container={c}
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
