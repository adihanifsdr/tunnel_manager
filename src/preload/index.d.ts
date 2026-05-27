import { ElectronAPI } from '@electron-toolkit/preload'
import type { SSHConfig, ContainerInfo, RecentConnection } from '../shared/types'

interface TunnelManagerAPI {
  loadConfig(): Promise<SSHConfig>
  saveConfig(config: SSHConfig): Promise<void>
  loadRecents(): Promise<RecentConnection[]>
  addRecent(config: SSHConfig): Promise<RecentConnection[]>
  removeRecent(config: SSHConfig): Promise<RecentConnection[]>
  scanContainers(config: SSHConfig): Promise<ContainerInfo[]>
  startTunnel(
    config: SSHConfig,
    containerId: string,
    remotePort: number
  ): Promise<{ localPort: number }>
  stopTunnel(containerId: string): Promise<void>
  stopAllTunnels(): Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TunnelManagerAPI
  }
}
