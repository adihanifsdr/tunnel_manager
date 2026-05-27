import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConnectionForm } from '@/components/ConnectionForm'
import { ContainerList } from '@/components/ContainerList'
import type { SSHConfig, ContainerInfo, TunnelState, RecentConnection } from '../../shared/types'

interface StatusMessage {
  text: string
  type: 'success' | 'error' | 'warning' | 'idle'
}

function App(): JSX.Element {
  const [config, setConfig] = useState<SSHConfig>({
    host: '',
    user: 'root',
    port: '22',
    keyPath: ''
  })
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [tunnels, setTunnels] = useState<Map<string, TunnelState>>(new Map())
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState<StatusMessage>({ text: 'Not connected', type: 'idle' })
  const [recents, setRecents] = useState<RecentConnection[]>([])

  useEffect(() => {
    window.api.loadConfig().then(setConfig).catch(console.error)
    window.api.loadRecents().then(setRecents).catch(console.error)
  }, [])

  const handleScan = useCallback(async () => {
    setScanning(true)
    setStatus({ text: 'Scanning...', type: 'warning' })

    try {
      await window.api.saveConfig(config)
      const result = await window.api.scanContainers(config)
      setContainers(result)
      setStatus({ text: `Found ${result.length} containers`, type: 'success' })
      const updated = await window.api.addRecent(config)
      setRecents(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus({ text: 'Error', type: 'error' })
      alert(`SSH Error:\n${msg}`)
    } finally {
      setScanning(false)
    }
  }, [config])

  const handleStartTunnel = useCallback(
    async (containerId: string, remotePort: number) => {
      try {
        setStatus({ text: 'Starting tunnel...', type: 'warning' })
        const { localPort } = await window.api.startTunnel(config, containerId, remotePort)
        setTunnels((prev) => {
          const next = new Map(prev)
          next.set(containerId, { containerId, localPort, remotePort, active: true })
          return next
        })
        const name = containers.find((c) => c.containerId === containerId)?.name ?? containerId
        setStatus({
          text: `Tunnel active: localhost:${localPort} → ${name}:${remotePort}`,
          type: 'success'
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setStatus({ text: 'Error', type: 'error' })
        alert(`Tunnel failed:\n${msg}`)
      }
    },
    [config, containers]
  )

  const handleStopTunnel = useCallback(
    async (containerId: string) => {
      try {
        await window.api.stopTunnel(containerId)
        setTunnels((prev) => {
          const next = new Map(prev)
          next.delete(containerId)
          return next
        })
        const name = containers.find((c) => c.containerId === containerId)?.name ?? containerId
        setStatus({ text: `Tunnel stopped: ${name}`, type: 'warning' })
      } catch (err) {
        console.error(err)
      }
    },
    [containers]
  )

  const handleSelectRecent = useCallback((recent: RecentConnection) => {
    const { host, user, port, keyPath } = recent
    setConfig({ host, user, port, keyPath })
  }, [])

  const handleRemoveRecent = useCallback(async (recent: RecentConnection) => {
    const updated = await window.api.removeRecent(recent)
    setRecents(updated)
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

  return (
    <div className="h-screen flex flex-col p-4 gap-3 overflow-hidden">
      <div>
        <h1 className="text-lg font-bold">SSH Tunnel Manager</h1>
        <p className="text-xs text-muted-foreground">
          Auto-detect Docker containers &amp; forward ports via SSH
        </p>
      </div>

      <ConnectionForm
        config={config}
        onChange={setConfig}
        onScan={handleScan}
        scanning={scanning}
        recents={recents}
        onSelectRecent={handleSelectRecent}
        onRemoveRecent={handleRemoveRecent}
      />

      <ContainerList
        containers={containers}
        tunnels={tunnels}
        status={status}
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
