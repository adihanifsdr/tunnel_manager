import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  SSHConfig,
  AppConfig,
  TunnelTarget,
  RecentConnection,
  SSHConfigHost,
  TunnelClosed
} from '../shared/types'

interface TunnelManagerAPI {
  loadConfig(): Promise<AppConfig>
  saveConfig(config: AppConfig): Promise<void>
  loadRecents(): Promise<RecentConnection[]>
  addRecent(config: SSHConfig): Promise<RecentConnection[]>
  removeRecent(config: SSHConfig): Promise<RecentConnection[]>
  loadSSHConfigHosts(): Promise<SSHConfigHost[]>
  scanContainers(config: SSHConfig): Promise<TunnelTarget[]>
  scanRenderServices(config: AppConfig): Promise<TunnelTarget[]>
  startTunnel(
    config: AppConfig,
    target: TunnelTarget,
    remotePort: number,
    via?: TunnelTarget
  ): Promise<{ localPort: number }>
  stopTunnel(targetId: string): Promise<void>
  stopAllTunnels(): Promise<void>
  /** subscribe to tunnels dropping on their own; returns an unsubscribe */
  onTunnelClosed(cb: (event: TunnelClosed) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TunnelManagerAPI
  }
}
