import {
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

/**
 * Icon by what the thing appears to be.
 *
 * Shape only — these used to carry each project's brand colour, which put
 * twenty unrelated hues in a list whose palette is doing real work elsewhere
 * (status, local, remote). The silhouette is what helps you scan; the colour
 * was just noise competing with the lamps.
 */
const SERVICE_ICONS: Array<[string, LucideIcon]> = [
  ['postgres', Database],
  ['postgis', Database],
  ['mysql', Database],
  ['mariadb', Database],
  ['mongo', Database],
  ['redis', Database],
  ['valkey', Database],
  ['memcached', Database],
  ['clickhouse', Database],
  ['elasticsearch', Search],
  ['opensearch', Search],
  ['kibana', BarChart3],
  ['grafana', BarChart3],
  ['prometheus', Activity],
  ['nginx', Globe],
  ['apache', Globe],
  ['httpd', Globe],
  ['caddy', Globe],
  ['traefik', Network],
  ['haproxy', Network],
  ['consul', Network],
  ['rabbitmq', MessageSquare],
  ['kafka', MessageSquare],
  ['nats', MessageSquare],
  ['node', Hexagon],
  ['python', Code],
  ['php', Code],
  ['ruby', Code],
  ['golang', Code],
  ['java', Code],
  ['dotnet', Code],
  ['gitlab', GitBranch],
  ['gitea', GitBranch],
  ['minio', HardDrive],
  ['vault', Lock],
  ['mailhog', Mail],
  ['mailpit', Mail]
]

/**
 * Matched against the name as well as the image: a Docker row carries an image
 * like `mongo:7`, but a Render row carries a service *type* (`private_service`)
 * that describes nothing, while its name (`hoodium-mongo`) usually does.
 */
export function serviceIcon(haystack: string): LucideIcon {
  const lower = haystack.toLowerCase()
  for (const [key, icon] of SERVICE_ICONS) {
    if (lower.includes(key)) return icon
  }
  return Box
}
