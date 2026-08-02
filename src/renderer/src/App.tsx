import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConnectionForm } from '@/components/ConnectionForm'
import { ContainerList } from '@/components/ContainerList'
import type { AppConfig, TunnelTarget, TunnelState, RecentConnection } from '../../shared/types'

interface StatusMessage {
  text: string
  type: 'success' | 'error' | 'warning' | 'idle'
}

const DEFAULT_CONFIG: AppConfig = {
  host: '',
  user: 'root',
  port: '22',
  keyPath: '',
  mode: 'ssh',
  render: { apiKey: '' },
  portMemory: {}
}

function App(): JSX.Element {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [targets, setTargets] = useState<TunnelTarget[]>([])
  const [tunnels, setTunnels] = useState<Map<string, TunnelState>>(new Map())
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState<StatusMessage>({ text: 'Not connected', type: 'idle' })
  const [recents, setRecents] = useState<RecentConnection[]>([])
  /**
   * Which Render service tunnels are routed through.
   *
   * Render's SSH shell is a fresh copy of the image with the start command not
   * run, so a service cannot be tunnelled to through itself — see
   * `startTunnel`. One service holds the session, and the forward names another
   * over the private network.
   */
  const [viaId, setViaId] = useState<string | null>(null)

  useEffect(() => {
    window.api.loadConfig().then(setConfig).catch(console.error)
    window.api.loadRecents().then(setRecents).catch(console.error)
  }, [])

  const isRender = config.mode === 'render'

  /*
   * Switching modes clears the list rather than leaving the previous mode's
   * targets on screen. They cannot be forwarded with the new mode's settings,
   * and a row that looks live but is not is worse than an empty panel.
   */
  const handleModeChange = useCallback((mode: AppConfig['mode']) => {
    setConfig((prev) => ({ ...prev, mode }))
    setTargets([])
    setStatus({ text: 'Not connected', type: 'idle' })
  }, [])

  const handleScan = useCallback(async () => {
    setScanning(true)
    setStatus({ text: 'Scanning...', type: 'warning' })

    try {
      await window.api.saveConfig(config)
      const result = isRender
        ? await window.api.scanRenderServices(config)
        : await window.api.scanContainers(config)
      setTargets(result)
      /*
       * Default the gateway to a web service, then a worker. Those run images
       * with the utilities an SSH session needs; a datastore image typically
       * does not, and closes the connection before a channel exists.
       */
      if (isRender) {
        const gateway =
          result.find((t) => t.image === 'web_service') ??
          result.find((t) => t.image === 'background_worker') ??
          result[0]
        setViaId(gateway?.id ?? null)
      }
      setStatus({
        text: `Found ${result.length} ${isRender ? 'services' : 'containers'}`,
        type: 'success'
      })
      // Recents are SSH connections; Render has one account and no host to recall.
      if (!isRender) {
        const { host, user, port, keyPath } = config
        setRecents(await window.api.addRecent({ host, user, port, keyPath }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus({ text: 'Error', type: 'error' })
      alert(`${isRender ? 'Render' : 'SSH'} Error:\n${msg}`)
    } finally {
      setScanning(false)
    }
  }, [config, isRender])

  const handleStartTunnel = useCallback(
    async (targetId: string, remotePort: number) => {
      const target = targets.find((t) => t.id === targetId)
      if (!target) return
      const via = isRender ? targets.find((t) => t.id === viaId) : undefined
      try {
        setStatus({ text: 'Starting tunnel...', type: 'warning' })
        const { localPort } = await window.api.startTunnel(config, target, remotePort, via)
        setTunnels((prev) => {
          const next = new Map(prev)
          next.set(targetId, { targetId, localPort, remotePort, active: true })
          return next
        })
        setStatus({
          text: `Tunnel active: localhost:${localPort} → ${target.name}:${remotePort}`,
          type: 'success'
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setStatus({ text: 'Error', type: 'error' })
        alert(`Tunnel failed:\n${msg}`)
      }
    },
    [config, targets, isRender, viaId]
  )

  const handleStopTunnel = useCallback(
    async (targetId: string) => {
      try {
        await window.api.stopTunnel(targetId)
        setTunnels((prev) => {
          const next = new Map(prev)
          next.delete(targetId)
          return next
        })
        const name = targets.find((t) => t.id === targetId)?.name ?? targetId
        setStatus({ text: `Tunnel stopped: ${name}`, type: 'warning' })
      } catch (err) {
        console.error(err)
      }
    },
    [targets]
  )

  const handleSelectRecent = useCallback((recent: RecentConnection) => {
    const { host, user, port, keyPath } = recent
    setConfig((prev) => ({ ...prev, host, user, port, keyPath }))
  }, [])

  const handleRemoveRecent = useCallback(async (recent: RecentConnection) => {
    setRecents(await window.api.removeRecent(recent))
  }, [])

  const handleStopAll = useCallback(async () => {
    try {
      await window.api.stopAllTunnels()
      setTunnels(new Map())
      setStatus({ text: 'All tunnels stopped', type: 'warning' })
    } catch (err) {
      console.error(err)
    }
  }, [])

  const subtitle = useMemo(
    () =>
      isRender
        ? 'List Render services & forward ports through their SSH gateway'
        : 'Auto-detect Docker containers & forward ports via SSH',
    [isRender]
  )

  return (
    <div className="h-screen flex flex-col p-4 gap-3 overflow-hidden">
      <div>
        <h1 className="text-lg font-bold">SSH Tunnel Manager</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <ConnectionForm
        config={config}
        onChange={setConfig}
        onModeChange={handleModeChange}
        onScan={handleScan}
        scanning={scanning}
        recents={recents}
        onSelectRecent={handleSelectRecent}
        onRemoveRecent={handleRemoveRecent}
      />

      <ContainerList
        targets={targets}
        tunnels={tunnels}
        status={status}
        mode={config.mode}
        viaId={viaId}
        onViaChange={setViaId}
        onStartTunnel={handleStartTunnel}
        onStopTunnel={handleStopTunnel}
      />

      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={handleStopAll}>
          Stop All Tunnels
        </Button>
      </div>
    </div>
  )
}

export default App
