import { Search, Server, Cloud, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RecentConnections } from './RecentConnections'
import type { AppConfig, AppMode, RecentConnection } from '../../../shared/types'

interface ConnectionFormProps {
  config: AppConfig
  onChange: (config: AppConfig) => void
  onModeChange: (mode: AppMode) => void
  onScan: () => void
  scanning: boolean
  recents: RecentConnection[]
  onSelectRecent: (recent: RecentConnection) => void
  onRemoveRecent: (recent: RecentConnection) => void
}

const INPUT =
  'bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary'

const MODES: Array<{ value: AppMode; label: string; icon: typeof Server }> = [
  { value: 'ssh', label: 'SSH / Docker', icon: Server },
  { value: 'render', label: 'Render.com', icon: Cloud }
]

export function ConnectionForm({
  config,
  onChange,
  onModeChange,
  onScan,
  scanning,
  recents,
  onSelectRecent,
  onRemoveRecent
}: ConnectionFormProps): JSX.Element {
  const [showKey, setShowKey] = useState(false)
  const isRender = config.mode === 'render'

  const update = (field: keyof AppConfig, value: string): void => {
    onChange({ ...config, [field]: value })
  }

  const canScan = isRender ? config.render.apiKey.trim().length > 0 : config.host.trim().length > 0

  return (
    <div className="bg-card rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-sm font-semibold">{isRender ? 'Render Account' : 'SSH Connection'}</h2>
        <div className="flex items-center gap-1 bg-background rounded-md p-0.5">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onModeChange(value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                config.mode === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {isRender ? (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground flex-1 min-w-[20rem]">
            API key:
            <input
              type={showKey ? 'text' : 'password'}
              value={config.render.apiKey}
              onChange={(e) => onChange({ ...config, render: { apiKey: e.target.value } })}
              placeholder="rnd_..."
              className={`${INPUT} flex-1 font-mono`}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
              title={showKey ? 'Hide' : 'Show'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Key:
            <input
              type="text"
              value={config.keyPath}
              onChange={(e) => update('keyPath', e.target.value)}
              placeholder="~/.ssh/id_ed25519"
              className={`${INPUT} w-52`}
            />
          </label>
          <Button onClick={onScan} disabled={scanning || !canScan} size="sm">
            <Search className="w-4 h-4" />
            {scanning ? 'Scanning...' : 'Scan Services'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Host:
            <input
              type="text"
              value={config.host}
              onChange={(e) => update('host', e.target.value)}
              placeholder="192.168.1.100"
              className={`${INPUT} w-44`}
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            User:
            <input
              type="text"
              value={config.user}
              onChange={(e) => update('user', e.target.value)}
              placeholder="root"
              className={`${INPUT} w-28`}
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Port:
            <input
              type="text"
              value={config.port}
              onChange={(e) => update('port', e.target.value)}
              placeholder="22"
              className={`${INPUT} w-16`}
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Key:
            <input
              type="text"
              value={config.keyPath}
              onChange={(e) => update('keyPath', e.target.value)}
              placeholder="~/.ssh/id_rsa"
              className={`${INPUT} w-52`}
            />
          </label>
          <Button onClick={onScan} disabled={scanning || !canScan} size="sm">
            <Search className="w-4 h-4" />
            {scanning ? 'Scanning...' : 'Scan Containers'}
          </Button>
        </div>
      )}

      {isRender ? (
        <p className="text-xs text-muted-foreground mt-2">
          Saved to <span className="font-mono">~/.tunnel_manager.json</span> in plaintext. Set{' '}
          <span className="font-mono">RENDER_API_KEY</span> in the environment to override it.
          Render authenticates tunnels with the SSH keys on your account.
        </p>
      ) : (
        <RecentConnections
          recents={recents}
          onSelect={onSelectRecent}
          onRemove={onRemoveRecent}
        />
      )}
    </div>
  )
}
