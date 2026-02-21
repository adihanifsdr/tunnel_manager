import { Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ContainerInfo } from '../../../shared/types'

interface ContainerRowProps {
  container: ContainerInfo
  tunnelLocalPort: number | null
  tunneling: boolean
  onStartTunnel: (containerId: string, remotePort: number) => void
  onStopTunnel: (containerId: string) => void
}

export function ContainerRow({
  container,
  tunnelLocalPort,
  tunneling,
  onStartTunnel,
  onStopTunnel
}: ContainerRowProps): JSX.Element {
  const imageShort = container.image.split('/').pop()?.slice(0, 35) ?? container.image
  const portsStr = container.ports.length
    ? container.ports.map((p) => `${p.port}/${p.protocol}`).join(', ')
    : 'no ports'
  const firstPort = container.ports[0]

  return (
    <div className="flex items-center justify-between py-2.5 px-3 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{container.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {imageShort} &bull; {portsStr} &bull; {container.status.slice(0, 30)}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {firstPort ? (
          tunneling && tunnelLocalPort ? (
            <>
              <span className="text-xs text-success font-mono">
                localhost:{tunnelLocalPort} &rarr; {firstPort.port}
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onStopTunnel(container.containerId)}
              >
                <Square className="w-3 h-3" />
                Stop
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="bg-success hover:bg-success/80 text-black font-semibold"
              onClick={() => onStartTunnel(container.containerId, firstPort.port)}
            >
              <Play className="w-3 h-3" />
              Forward :{firstPort.port}
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">no ports</span>
        )}
      </div>
    </div>
  )
}
