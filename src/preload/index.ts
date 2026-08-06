import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  SSHConfig,
  AppConfig,
  TunnelTarget,
  RecentConnection,
  TunnelClosed
} from '../shared/types'

const api = {
  loadConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:load'),

  saveConfig: (config: AppConfig): Promise<void> => ipcRenderer.invoke('config:save', config),

  loadRecents: (): Promise<RecentConnection[]> => ipcRenderer.invoke('recents:load'),

  addRecent: (config: SSHConfig): Promise<RecentConnection[]> =>
    ipcRenderer.invoke('recents:add', config),

  removeRecent: (config: SSHConfig): Promise<RecentConnection[]> =>
    ipcRenderer.invoke('recents:remove', config),

  /** SSH mode — `docker ps` on the remote host. */
  scanContainers: (config: SSHConfig): Promise<TunnelTarget[]> =>
    ipcRenderer.invoke('ssh:scan-containers', config),

  /** Render mode — the account's services, via the Render API. */
  scanRenderServices: (config: AppConfig): Promise<TunnelTarget[]> =>
    ipcRenderer.invoke('render:scan-services', config),

  startTunnel: (
    config: AppConfig,
    target: TunnelTarget,
    remotePort: number,
    via?: TunnelTarget
  ): Promise<{ localPort: number }> =>
    ipcRenderer.invoke('tunnel:start', config, target, remotePort, via),

  stopTunnel: (targetId: string): Promise<void> => ipcRenderer.invoke('tunnel:stop', targetId),

  stopAllTunnels: (): Promise<void> => ipcRenderer.invoke('tunnel:stop-all'),

  /** fires when a tunnel drops without being asked to */
  onTunnelClosed: (cb: (event: TunnelClosed) => void): (() => void) => {
    const listener = (_e: unknown, payload: TunnelClosed): void => cb(payload)
    ipcRenderer.on('tunnel:closed', listener)
    return () => ipcRenderer.removeListener('tunnel:closed', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
