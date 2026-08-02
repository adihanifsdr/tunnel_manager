import { useState } from 'react'
import {
  Play,
  Square,
  Database,
  Globe,
  MessageSquare,
  Search,
  BarChart3,
  Activity,
  GitBranch,
  HardDrive,
  Lock,
  Network,
  Hexagon,
  Code,
  Mail,
  Box,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TunnelTarget } from '../../../shared/types'

const SERVICE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  postgres: { icon: Database, color: '#336791' },
  mysql: { icon: Database, color: '#4479A1' },
  mariadb: { icon: Database, color: '#003545' },
  mongo: { icon: Database, color: '#47A248' },
  redis: { icon: Database, color: '#DC382D' },
  memcached: { icon: Database, color: '#6DB33F' },
  elasticsearch: { icon: Search, color: '#FEC514' },
  opensearch: { icon: Search, color: '#005EB8' },
  kibana: { icon: BarChart3, color: '#F04E98' },
  grafana: { icon: BarChart3, color: '#F46800' },
  prometheus: { icon: Activity, color: '#E6522C' },
  nginx: { icon: Globe, color: '#009639' },
  apache: { icon: Globe, color: '#D22128' },
  httpd: { icon: Globe, color: '#D22128' },
  traefik: { icon: Network, color: '#24A1C1' },
  caddy: { icon: Globe, color: '#1F88C0' },
  haproxy: { icon: Network, color: '#106DA1' },
  rabbitmq: { icon: MessageSquare, color: '#FF6600' },
  kafka: { icon: MessageSquare, color: '#231F20' },
  nats: { icon: MessageSquare, color: '#27AAE1' },
  node: { icon: Hexagon, color: '#339933' },
  python: { icon: Code, color: '#3776AB' },
  php: { icon: Code, color: '#777BB4' },
  ruby: { icon: Code, color: '#CC342D' },
  golang: { icon: Code, color: '#00ADD8' },
  java: { icon: Code, color: '#ED8B00' },
  dotnet: { icon: Code, color: '#512BD4' },
  gitlab: { icon: GitBranch, color: '#FC6D26' },
  gitea: { icon: GitBranch, color: '#609926' },
  minio: { icon: HardDrive, color: '#C72C48' },
  vault: { icon: Lock, color: '#FFEC6E' },
  consul: { icon: Network, color: '#F24C53' },
  mailhog: { icon: Mail, color: '#D14836' },
  mailpit: { icon: Mail, color: '#D14836' }
}

/**
 * Matched against the name as well as the image.
 *
 * A Docker row carries an image like `mongo:7`, which the table was written
 * for. A Render row has a service *type* — `private_service` — which describes
 * nothing, while its name (`hoodium-mongo`) usually does.
 */
function getServiceIcon(haystack: string): { icon: LucideIcon; color: string } {
  const lower = haystack.toLowerCase()
  for (const [key, value] of Object.entries(SERVICE_ICONS)) {
    if (lower.includes(key)) return value
  }
  return { icon: Box, color: '#6b7280' }
}

interface ContainerRowProps {
  target: TunnelTarget
  tunnelLocalPort: number | null
  tunneling: boolean
  onStartTunnel: (targetId: string, remotePort: number) => void
  onStopTunnel: (targetId: string) => void
}

export function ContainerRow({
  target,
  tunnelLocalPort,
  tunneling,
  onStartTunnel,
  onStopTunnel
}: ContainerRowProps): JSX.Element {
  /*
   * The port is typed, not picked.
   *
   * Discovery only ever produced a suggestion — the row used to forward
   * `ports[0]` and offer no way to reach any other port a container exposed.
   * Render makes that worse than a limitation: the port a service registers
   * with the platform is not reliably the port the process listens on, so the
   * suggestion is sometimes simply wrong and has to be correctable.
   */
  const [port, setPort] = useState(String(target.ports[0]?.port ?? ''))
  const parsed = parseInt(port, 10)
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 65535

  const context =
    target.kind === 'render'
      ? [target.image, target.privateHost, target.status].filter(Boolean).join(' • ')
      : [
          target.image.split('/').pop()?.slice(0, 35) ?? target.image,
          target.ports.length
            ? target.ports.map((p) => `${p.port}/${p.protocol}`).join(', ')
            : 'no ports',
          target.status.slice(0, 30)
        ].join(' • ')

  const { icon: ServiceIcon, color: iconColor } = getServiceIcon(`${target.name} ${target.image}`)

  return (
    <div className="flex items-center justify-between py-2.5 px-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md shrink-0"
          style={{ backgroundColor: iconColor + '20' }}
        >
          <ServiceIcon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{target.name}</p>
          <p className="text-xs text-muted-foreground truncate">{context}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {tunneling && tunnelLocalPort ? (
          <>
            <span className="text-xs text-success font-mono">
              localhost:{tunnelLocalPort} &rarr; {port}
            </span>
            <Button variant="destructive" size="sm" onClick={() => onStopTunnel(target.id)}>
              <Square className="w-3 h-3" />
              Stop
            </Button>
          </>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
              placeholder="port"
              title="Remote port to forward"
              className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground w-20 text-center focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              size="sm"
              disabled={!valid}
              className="bg-success hover:bg-success/80 text-black font-semibold disabled:opacity-40"
              onClick={() => onStartTunnel(target.id, parsed)}
            >
              <Play className="w-3 h-3" />
              Forward
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
