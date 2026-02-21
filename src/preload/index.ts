import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { SSHConfig, ContainerInfo } from '../shared/types'

const api = {
  loadConfig: (): Promise<SSHConfig> => ipcRenderer.invoke('config:load'),

  saveConfig: (config: SSHConfig): Promise<void> => ipcRenderer.invoke('config:save', config),

  scanContainers: (config: SSHConfig): Promise<ContainerInfo[]> =>
    ipcRenderer.invoke('ssh:scan-containers', config),

  startTunnel: (
    config: SSHConfig,
    containerId: string,
    remotePort: number
  ): Promise<{ localPort: number }> =>
    ipcRenderer.invoke('ssh:start-tunnel', config, containerId, remotePort),

  stopTunnel: (containerId: string): Promise<void> =>
    ipcRenderer.invoke('ssh:stop-tunnel', containerId),

  stopAllTunnels: (): Promise<void> => ipcRenderer.invoke('ssh:stop-all')
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
