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
  const statusColor = {
    success: 'text-success',
    error: 'text-destructive',
    warning: 'text-warning',
    idle: 'text-muted-foreground'
  }[status.type]

  return (
    <div className="bg-card rounded-lg flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold">Containers</h2>
        <span className={`text-xs ${statusColor}`}>{status.text}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {containers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No containers found.</p>
        ) : (
          containers.map((c) => {
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
