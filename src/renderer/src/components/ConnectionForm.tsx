import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecentConnections } from './RecentConnections'
import type { SSHConfig, RecentConnection } from '../../../shared/types'

interface ConnectionFormProps {
  config: SSHConfig
  onChange: (config: SSHConfig) => void
  onScan: () => void
  scanning: boolean
  recents: RecentConnection[]
  onSelectRecent: (recent: RecentConnection) => void
  onRemoveRecent: (recent: RecentConnection) => void
}

export function ConnectionForm({
  config,
  onChange,
  onScan,
  scanning,
  recents,
  onSelectRecent,
  onRemoveRecent
}: ConnectionFormProps): JSX.Element {
  const update = (field: keyof SSHConfig, value: string): void => {
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="bg-card rounded-lg p-4">
      <h2 className="text-sm font-semibold mb-3">SSH Connection</h2>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Host:
          <input
            type="text"
            value={config.host}
            onChange={(e) => update('host', e.target.value)}
            placeholder="192.168.1.100"
            className="bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground w-44 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          User:
          <input
            type="text"
            value={config.user}
            onChange={(e) => update('user', e.target.value)}
            placeholder="root"
            className="bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground w-28 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Port:
          <input
            type="text"
            value={config.port}
            onChange={(e) => update('port', e.target.value)}
            placeholder="22"
            className="bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground w-16 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Key:
          <input
            type="text"
            value={config.keyPath}
            onChange={(e) => update('keyPath', e.target.value)}
            placeholder="~/.ssh/id_rsa"
            className="bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground w-52 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <Button onClick={onScan} disabled={scanning || !config.host.trim()} size="sm">
          <Search className="w-4 h-4" />
          {scanning ? 'Scanning...' : 'Scan Containers'}
        </Button>
      </div>
      <RecentConnections
        recents={recents}
        onSelect={onSelectRecent}
        onRemove={onRemoveRecent}
      />
    </div>
  )
}
