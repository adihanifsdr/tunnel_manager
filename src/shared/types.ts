export interface SSHConfig {
  host: string
  user: string
  port: string
  keyPath: string
}

export interface ContainerPort {
  port: number
  protocol: string
}

export interface ContainerInfo {
  containerId: string
  name: string
  image: string
  ports: ContainerPort[]
  status: string
}

export interface TunnelState {
  containerId: string
  localPort: number
  remotePort: number
  active: boolean
}

export const IPC_CHANNELS = {
  CONFIG_LOAD: 'config:load',
  CONFIG_SAVE: 'config:save',
  SCAN_CONTAINERS: 'ssh:scan-containers',
  START_TUNNEL: 'ssh:start-tunnel',
  STOP_TUNNEL: 'ssh:stop-tunnel',
  STOP_ALL: 'ssh:stop-all'
} as const
