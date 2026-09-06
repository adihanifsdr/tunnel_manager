import { useState } from 'react'
import { Eye, EyeOff, Clock, X, FileKey } from 'lucide-react'
import type { AppConfig, RecentConnection, SSHConfig, SSHConfigHost } from '../../../shared/types'
import { cn } from '@/lib/utils'

const FIELD =
  'rounded border border-line bg-chassis px-2 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none'

const CHIP =
  'group flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors'

interface Props {
  config: AppConfig
  recents: RecentConnection[]
  /** `Host` entries from `~/.ssh/config`; empty when there is no such file */
  sshHosts: SSHConfigHost[]
  onChange: (config: AppConfig) => void
  onSelectRecent: (recent: RecentConnection) => void
  onRemoveRecent: (recent: RecentConnection) => void
  onSelectSSHHost: (host: SSHConfigHost) => void
}

/** The form holds exactly this connection — same endpoint and same key. */
function sameConnection(a: SSHConfig, b: SSHConfig): boolean {
  return (
    a.host.trim() === b.host.trim() &&
    a.user.trim() === b.user.trim() &&
    (a.port.trim() || '22') === (b.port.trim() || '22') &&
    a.keyPath.trim() === b.keyPath.trim()
  )
}

function formatAge(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

/**
 * Setup, not workspace: this is filled once per session and then in the way, so
 * the context bar collapses it after a scan succeeds.
 */
export function ConnectionPanel({
  config,
  recents,
  sshHosts,
  onChange,
  onSelectRecent,
  onRemoveRecent,
  onSelectSSHHost
}: Props): JSX.Element {
  const [showKey, setShowKey] = useState(false)
  const isRender = config.mode === 'render'

  const update = (field: 'host' | 'user' | 'port' | 'keyPath', value: string): void => {
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="shrink-0 border-b border-line bg-surface2/50 px-4 py-3">
      {isRender ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[22rem] flex-1 flex-col gap-1">
            <span className="eyebrow">api key</span>
            <span className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.render.apiKey}
                onChange={(e) => onChange({ ...config, render: { apiKey: e.target.value } })}
                placeholder="rnd_…"
                className={cn(FIELD, 'w-full pr-8')}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 text-ink-dim hover:text-ink"
                title={showKey ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="eyebrow">ssh key</span>
            <input
              value={config.keyPath}
              onChange={(e) => update('keyPath', e.target.value)}
              placeholder="~/.ssh/id_ed25519"
              className={cn(FIELD, 'w-56')}
            />
          </label>

          <p className="min-w-[18rem] flex-1 text-[11px] leading-relaxed text-ink-dim">
            Key disimpan apa adanya di <span className="font-mono">~/.tunnel_manager.json</span>.
            Set <span className="font-mono">RENDER_API_KEY</span> di environment untuk menimpanya.
            Tunnel-nya sendiri diautentikasi pakai SSH key yang terdaftar di akun Render.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="eyebrow">host</span>
              <input
                value={config.host}
                onChange={(e) => update('host', e.target.value)}
                placeholder="192.168.1.100"
                className={cn(FIELD, 'w-48')}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">user</span>
              <input
                value={config.user}
                onChange={(e) => update('user', e.target.value)}
                placeholder="root"
                className={cn(FIELD, 'w-32')}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">port</span>
              <input
                value={config.port}
                onChange={(e) => update('port', e.target.value.replace(/\D/g, ''))}
                placeholder="22"
                inputMode="numeric"
                className={cn(FIELD, 'w-20')}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="eyebrow">ssh key</span>
              <input
                value={config.keyPath}
                onChange={(e) => update('keyPath', e.target.value)}
                placeholder="~/.ssh/id_rsa — kosongkan untuk identity bawaan"
                className={cn(FIELD, 'w-full min-w-[16rem]')}
              />
            </label>
          </div>

          {/* ~/.ssh/config is the list most people already maintain, so it comes
              first; the alias is the label because that is how they know the
              host, and the resolved endpoint lives in the tooltip */}
          {sshHosts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim"
                title="Host dari ~/.ssh/config"
              >
                <FileKey size={11} /> ssh config
              </span>
              {sshHosts.map((h) => {
                const active = sameConnection(config, h)
                return (
                  <button
                    key={h.alias}
                    onClick={() => onSelectSSHHost(h)}
                    aria-pressed={active}
                    className={cn(
                      CHIP,
                      active
                        ? 'border-accent/60 bg-accent/10 text-ink'
                        : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                    )}
                    title={`${h.user}@${h.host}:${h.port}\nkey: ${h.keyPath || 'bawaan'}`}
                  >
                    {h.alias}
                  </button>
                )
              })}
            </div>
          )}

          {recents.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                <Clock size={11} /> terakhir
              </span>
              {recents.map((r) => {
                const label = `${r.user}@${r.host}:${r.port}`
                return (
                  <span
                    key={label}
                    className={cn(
                      CHIP,
                      'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                    )}
                  >
                    <button
                      onClick={() => onSelectRecent(r)}
                      title={`${label}\nkey: ${r.keyPath || 'bawaan'}\n${formatAge(r.lastUsed)}`}
                    >
                      {label}
                    </button>
                    <button
                      onClick={() => onRemoveRecent(r)}
                      className="text-ink-dim opacity-0 transition-opacity hover:text-lamp-error group-hover:opacity-100"
                      title="Hapus dari daftar"
                      aria-label={`Hapus ${label}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
