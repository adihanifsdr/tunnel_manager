import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type {
  AppConfig,
  AppMode,
  RecentConnection,
  TunnelState,
  TunnelTarget
} from '../../shared/types'
import { ContextBar } from './components/ContextBar'
import { ConnectionPanel } from './components/ConnectionPanel'
import { TargetRow } from './components/TargetRow'
import { DetailPanel } from './components/DetailPanel'
import { PortMapLegend } from './components/PortMap'

const DEFAULT_CONFIG: AppConfig = {
  host: '',
  user: 'root',
  port: '22',
  keyPath: '',
  mode: 'ssh',
  theme: 'dark',
  render: { apiKey: '' },
  portMemory: {}
}

function App(): JSX.Element {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [targets, setTargets] = useState<TunnelTarget[]>([])
  const [tunnels, setTunnels] = useState<Map<string, TunnelState>>(new Map())
  const [connecting, setConnecting] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())
  const [ports, setPorts] = useState<Record<string, string>>({})
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [recents, setRecents] = useState<RecentConnection[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [connectionOpen, setConnectionOpen] = useState(true)
  /**
   * Which Render service holds the SSH session.
   *
   * Render's shell is a fresh copy of the image with the start command not run,
   * so a service can never be tunnelled to through itself — one service holds
   * the session and the forward names another over the private network.
   */
  const [gatewayId, setGatewayId] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const isRender = config.mode === 'render'

  useEffect(() => {
    window.api
      .loadConfig()
      .then((loaded) => {
        setConfig(loaded)
        // Setup starts open only when there is nothing to connect with yet.
        const ready = loaded.mode === 'render' ? loaded.render.apiKey.trim() : loaded.host.trim()
        setConnectionOpen(!ready)
      })
      .catch(console.error)
    window.api.loadRecents().then(setRecents).catch(console.error)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = config.theme
    document.documentElement.dataset.mode = config.mode
  }, [config.theme, config.mode])

  // a tunnel that dropped on its own must stop claiming a port
  useEffect(() => {
    return window.api.onTunnelClosed(({ targetId, reason }) => {
      setTunnels((prev) => {
        if (!prev.has(targetId)) return prev
        const next = new Map(prev)
        next.delete(targetId)
        return next
      })
      setErrors((prev) => new Map(prev).set(targetId, reason || 'Tunnel terputus tanpa diminta.'))
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')
      if ((e.ctrlKey && e.key === 'f') || (e.key === '/' && !typing)) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key === 'Escape') {
        if (query) setQuery('')
        else if (selectedId) setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [query, selectedId])

  const persist = useCallback((next: AppConfig): void => {
    setConfig(next)
    void window.api.saveConfig(next)
  }, [])

  const canScan = isRender ? config.render.apiKey.trim().length > 0 : config.host.trim().length > 0

  const handleModeChange = (mode: AppMode): void => {
    // targets from the other mode cannot be forwarded with these settings, and a
    // row that looks usable but is not is worse than an empty list
    persist({ ...config, mode })
    setTargets([])
    setSelectedId(null)
    setScanError(null)
    setErrors(new Map())
    const ready = mode === 'render' ? config.render.apiKey.trim() : config.host.trim()
    setConnectionOpen(!ready)
  }

  const handleScan = async (): Promise<void> => {
    setScanning(true)
    setScanError(null)
    try {
      await window.api.saveConfig(config)
      const result = isRender
        ? await window.api.scanRenderServices(config)
        : await window.api.scanContainers(config)

      setTargets(result)
      setErrors(new Map())
      setSelectedId(null)
      setPorts(Object.fromEntries(result.map((t) => [t.id, String(t.ports[0]?.port ?? '')])))
      // Setup has done its job; give the space back to the list.
      setConnectionOpen(false)

      if (isRender) {
        // web services and workers run images that can host a session; a
        // datastore image usually closes the connection before a channel exists
        const gateway =
          result.find((t) => t.image === 'web_service') ??
          result.find((t) => t.image === 'background_worker') ??
          result[0]
        setGatewayId(gateway?.id ?? null)
      } else {
        const { host, user, port, keyPath } = config
        setRecents(await window.api.addRecent({ host, user, port, keyPath }))
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  const handleConnect = async (targetId: string, remotePort: number): Promise<void> => {
    const target = targets.find((t) => t.id === targetId)
    if (!target) return
    const via = isRender ? targets.find((t) => t.id === gatewayId) : undefined

    setConnecting((prev) => new Set(prev).add(targetId))
    setErrors((prev) => {
      if (!prev.has(targetId)) return prev
      const next = new Map(prev)
      next.delete(targetId)
      return next
    })

    try {
      const { localPort } = await window.api.startTunnel(config, target, remotePort, via)
      setTunnels((prev) =>
        new Map(prev).set(targetId, { targetId, localPort, remotePort, active: true })
      )
    } catch (err) {
      // Errors belong next to the row that failed, not in a modal that loses them
      setErrors((prev) =>
        new Map(prev).set(targetId, err instanceof Error ? err.message : String(err))
      )
    } finally {
      setConnecting((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    }
  }

  const handleDisconnect = async (targetId: string): Promise<void> => {
    try {
      await window.api.stopTunnel(targetId)
    } catch (err) {
      console.error(err)
    }
    setTunnels((prev) => {
      const next = new Map(prev)
      next.delete(targetId)
      return next
    })
  }

  const handleStopAll = async (): Promise<void> => {
    try {
      await window.api.stopAllTunnels()
    } catch (err) {
      console.error(err)
    }
    setTunnels(new Map())
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = targets.filter((t) => {
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.image.toLowerCase().includes(q) ||
        (ports[t.id] ?? '').includes(q) ||
        String(tunnels.get(t.id)?.localPort ?? '').includes(q)
      )
    })
    const live = visible.filter((t) => tunnels.get(t.id)?.active)
    const rest = visible.filter((t) => !tunnels.get(t.id)?.active)
    return [
      { key: 'live', title: 'Tersambung', rows: live },
      { key: 'rest', title: isRender ? 'Service lain' : 'Container lain', rows: rest }
    ].filter((g) => g.rows.length > 0)
  }, [targets, query, tunnels, ports, isRender])

  const shown = groups.reduce((n, g) => n + g.rows.length, 0)
  const selected = targets.find((t) => t.id === selectedId) ?? null
  const gateway = targets.find((t) => t.id === gatewayId) ?? null
  const noun = isRender ? 'service' : 'container'

  return (
    <div className="flex h-screen flex-col bg-chassis">
      <ContextBar
        config={config}
        theme={config.theme}
        liveCount={tunnels.size}
        connectingCount={connecting.size}
        scanning={scanning}
        canScan={canScan}
        connectionOpen={connectionOpen}
        onToggleConnection={() => setConnectionOpen((v) => !v)}
        onModeChange={handleModeChange}
        onScan={() => void handleScan()}
        onStopAll={() => void handleStopAll()}
        onToggleTheme={() =>
          persist({ ...config, theme: config.theme === 'dark' ? 'light' : 'dark' })
        }
      />

      {connectionOpen && (
        <ConnectionPanel
          config={config}
          recents={recents}
          onChange={persist}
          onSelectRecent={({ host, user, port, keyPath }) =>
            persist({ ...config, host, user, port, keyPath })
          }
          onRemoveRecent={(recent) => void window.api.removeRecent(recent).then(setRecents)}
        />
      )}

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(420px,48%)_1fr] gap-3 p-3">
        <div className="flex min-h-0 flex-col gap-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Cari ${noun} atau port…`}
                spellCheck={false}
                className="w-full rounded-md border border-line bg-surface py-1.5 pl-8 pr-8 text-[12px] text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink"
                  title="Hapus pencarian"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 px-0.5">
            <PortMapLegend />
            <span className="h-3 w-px bg-line" />
            <span className="font-mono text-[10px] text-ink-dim">
              {targets.length === 0 ? 'belum ada hasil scan' : `${shown} dari ${targets.length}`}
            </span>
          </div>

          {scanError && (
            <div className="shrink-0 select-text whitespace-pre-wrap break-words rounded-md border border-lamp-error/30 bg-lamp-error/10 px-2.5 py-2 font-mono text-[10px] text-lamp-error">
              Scan gagal: {scanError}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
            {targets.length === 0 && !scanError && (
              <p className="font-mono text-[11px] text-ink-dim">
                {canScan
                  ? 'Tekan Scan untuk mengambil daftar target.'
                  : `Isi detail ${isRender ? 'akun Render' : 'koneksi SSH'} di atas, lalu Scan.`}
              </p>
            )}
            {targets.length > 0 && shown === 0 && (
              <p className="font-mono text-[11px] text-ink-dim">
                Tidak ada {noun} yang cocok dengan “{query}”.
              </p>
            )}

            {groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="eyebrow">{group.title}</span>
                  <span className="font-mono text-[10px] text-ink-dim">{group.rows.length}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                {group.rows.map((t) => (
                  <TargetRow
                    key={t.id}
                    target={t}
                    tunnel={tunnels.get(t.id)}
                    connecting={connecting.has(t.id)}
                    error={errors.get(t.id)}
                    isGateway={isRender && t.id === gatewayId}
                    selected={selectedId === t.id}
                    port={ports[t.id] ?? ''}
                    onPortChange={(port) => setPorts((prev) => ({ ...prev, [t.id]: port }))}
                    onSelect={() => setSelectedId(t.id)}
                    onConnect={(remotePort) => void handleConnect(t.id, remotePort)}
                    onDisconnect={() => void handleDisconnect(t.id)}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>

        <DetailPanel
          target={selected}
          tunnel={selected ? tunnels.get(selected.id) : undefined}
          connecting={selected ? connecting.has(selected.id) : false}
          error={selected ? errors.get(selected.id) : undefined}
          port={selected ? (ports[selected.id] ?? '') : ''}
          isRender={isRender}
          gateway={gateway}
          targets={targets}
          onGatewayChange={setGatewayId}
          onConnect={() => {
            if (!selected) return
            const parsed = parseInt(ports[selected.id] ?? '', 10)
            if (Number.isFinite(parsed) && parsed > 0) void handleConnect(selected.id, parsed)
          }}
          onDisconnect={() => selected && void handleDisconnect(selected.id)}
        />
      </main>
    </div>
  )
}

export default App
