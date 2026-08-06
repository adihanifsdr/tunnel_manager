import { Server, Cloud, Search, Square, Sun, Moon, ChevronDown } from 'lucide-react'
import type { AppConfig, AppMode, ThemeId } from '../../../shared/types'
import { cn } from '@/lib/utils'
import { StatusDot } from './StatusLamp'

const MODES: Array<{ value: AppMode; label: string; icon: typeof Server }> = [
  { value: 'ssh', label: 'ssh / docker', icon: Server },
  { value: 'render', label: 'render', icon: Cloud }
]

interface Props {
  config: AppConfig
  theme: ThemeId
  liveCount: number
  connectingCount: number
  scanning: boolean
  canScan: boolean
  connectionOpen: boolean
  onToggleConnection: () => void
  onModeChange: (mode: AppMode) => void
  onScan: () => void
  onStopAll: () => void
  onToggleTheme: () => void
}

export function ContextBar({
  config,
  theme,
  liveCount,
  connectingCount,
  scanning,
  canScan,
  connectionOpen,
  onToggleConnection,
  onModeChange,
  onScan,
  onStopAll,
  onToggleTheme
}: Props): JSX.Element {
  const isRender = config.mode === 'render'
  const identity = isRender
    ? config.render.apiKey.trim()
      ? 'akun Render'
      : 'API key belum diisi'
    : config.host.trim()
      ? `${config.user || 'root'}@${config.host}${config.port && config.port !== '22' ? `:${config.port}` : ''}`
      : 'host belum diisi'

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="flex items-stretch">
        {/* mode owns the far left: it decides where targets come from */}
        <div className="flex items-stretch border-r border-line">
          {MODES.map(({ value, label, icon: Icon }) => {
            const active = config.mode === value
            return (
              <button
                key={value}
                onClick={() => onModeChange(value)}
                aria-pressed={active}
                className={cn(
                  'relative flex items-center gap-1.5 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors',
                  active ? 'text-ink' : 'text-ink-dim hover:text-ink-muted'
                )}
              >
                <Icon size={13} />
                {label}
                <span
                  className={cn(
                    'absolute bottom-0 left-3 right-3 h-[2px] rounded-t transition-colors',
                    active ? 'bg-accent glow-accent' : 'bg-transparent'
                  )}
                />
              </button>
            )
          })}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
          <button
            onClick={onToggleConnection}
            className="flex min-w-0 items-center gap-1.5 text-left"
            title={connectionOpen ? 'Tutup detail koneksi' : 'Buka detail koneksi'}
          >
            <span className="eyebrow shrink-0">{isRender ? 'akun' : 'koneksi'}</span>
            <span
              className={cn(
                'truncate font-mono text-[12px]',
                config.host.trim() || (isRender && config.render.apiKey.trim())
                  ? 'text-ink'
                  : 'text-ink-dim'
              )}
            >
              {identity}
            </span>
            <ChevronDown
              size={13}
              className={cn(
                'shrink-0 text-ink-dim transition-transform',
                connectionOpen && 'rotate-180'
              )}
            />
          </button>

          <div className="flex-1" />

          <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-ink">
            <span className="flex items-center gap-1.5" title="tunnel tersambung">
              <StatusDot state="live" />
              {liveCount}
            </span>
            {connectingCount > 0 && (
              <span className="flex items-center gap-1.5" title="sedang menyambung">
                <StatusDot state="connecting" />
                {connectingCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 px-3">
          <button
            onClick={onScan}
            disabled={scanning || !canScan}
            title={canScan ? 'Ambil daftar target' : 'Isi detail koneksi dulu'}
            className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent/25 disabled:opacity-35 disabled:hover:bg-accent/15"
          >
            <Search size={13} className={scanning ? 'animate-breathe' : ''} />
            {scanning ? 'Memindai…' : 'Scan'}
          </button>

          <button
            onClick={onToggleTheme}
            className="rounded-md p-2 text-ink-muted transition-colors hover:bg-surface2 hover:text-ink"
            title={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
            aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            onClick={onStopAll}
            disabled={liveCount + connectingCount === 0}
            className="flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-lamp-error/50 hover:text-ink disabled:opacity-35 disabled:hover:border-line-strong disabled:hover:text-ink-muted"
          >
            <Square size={12} /> Putuskan semua
          </button>
        </div>
      </div>
    </header>
  )
}
