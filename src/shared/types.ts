/**
 * Types shared between the Electron main process, the preload bridge and the UI.
 *
 * ── Two ways to find something to forward ────────────────────────────────────
 * The app started as "SSH to a Docker host, run `docker ps`, forward a container
 * port". Render.com does not fit that shape at all: its SSH drops you *inside*
 * your own service's container, so there is no Docker daemon to ask and nothing
 * to discover by asking it.
 *
 * What does carry over is the half that matters — every tunnel here is still
 * `ssh -L <local>:<host>:<port>`. So the mode changes where the list of things
 * comes from, and what the SSH endpoint is, and nothing else. `TunnelTarget` is
 * the shape both modes produce, which is what keeps the tunnel code from
 * branching on mode more than once.
 */

/** Where targets come from. Persisted, so the app reopens in the mode you left. */
export type AppMode = 'ssh' | 'render'

export interface SSHConfig {
  host: string
  user: string
  port: string
  keyPath: string
}

export interface RenderConfig {
  /**
   * Render API key.
   *
   * Stored in `~/.tunnel_manager.json` in plaintext, like every other field
   * here — see the security notes in the README. It is a full-account
   * credential, so `RENDER_API_KEY` in the environment overrides it and is the
   * better place for it on a machine anyone else can read.
   */
  apiKey: string
}

/**
 * Everything persisted to `~/.tunnel_manager.json`.
 *
 * The SSH fields stay at the top level rather than nesting under `ssh`, because
 * that is where earlier versions wrote them and a config file that silently
 * forgets your connection on upgrade is a worse bug than an untidy shape.
 */
export type ThemeId = 'dark' | 'light'

export interface AppConfig extends SSHConfig {
  mode: AppMode
  theme: ThemeId
  render: RenderConfig
  /**
   * The port that last worked for a target, keyed by `mode:name`.
   *
   * Every other source of a port is a guess — Render reports what a service
   * registered, which is not always where it listens, and the well-known-port
   * table is pattern matching on a name. A port you actually tunnelled through
   * is evidence, so it outranks both and survives a restart.
   *
   * Keyed by name rather than id because a Docker container id changes every
   * time the container is recreated, and the thing being remembered does not.
   */
  portMemory: Record<string, number>
}

/** Stable key for `portMemory`. See the field's note on why not the id. */
export function portMemoryKey(mode: AppMode, name: string): string {
  return `${mode}:${name}`
}

export interface RecentConnection extends SSHConfig {
  lastUsed: number
}

export interface ContainerPort {
  port: number
  protocol: string
}

/** Which discovery produced a target, and therefore how it is tunnelled to. */
export type TargetKind = 'docker' | 'render'

/**
 * One forwardable thing, from either mode.
 *
 * `ports` is what discovery *believes* is exposed, and the UI treats it as a
 * suggestion rather than a constraint — see `ContainerRow`. On Render in
 * particular the port a service registers with the platform is not always the
 * port the process listens on, so a value that cannot be typed over would be a
 * value that is sometimes simply wrong.
 */
export interface TunnelTarget {
  kind: TargetKind
  /** Container id, or Render service id. Unique within a scan. */
  id: string
  name: string
  /** Docker image, or Render service type. Shown as context, and used for icons. */
  image: string
  /** Docker status line, or Render region/plan/suspension. */
  status: string
  ports: ContainerPort[]
  /**
   * Render only — the per-service SSH gateway, e.g.
   * `srv-abc123@ssh.singapore.render.com`. Render authenticates with the SSH
   * keys on your account, so there is no user or port to configure.
   */
  sshAddress?: string
  /** Render only — the private hostname, shown so the mapping is legible. */
  privateHost?: string
}

export interface TunnelState {
  targetId: string
  localPort: number
  remotePort: number
  active: boolean
}

/**
 * Pushed when a tunnel goes down on its own — network drop, host restart, the
 * remote closing the channel.
 *
 * Without it the row keeps claiming a port that nothing is listening on any
 * more, which is the one thing this list must never do.
 */
export interface TunnelClosed {
  targetId: string
  /** last words from ssh's stderr, when it said anything */
  reason: string
}

export const IPC_CHANNELS = {
  CONFIG_LOAD: 'config:load',
  CONFIG_SAVE: 'config:save',
  RECENTS_LOAD: 'recents:load',
  RECENTS_ADD: 'recents:add',
  RECENTS_REMOVE: 'recents:remove',
  SCAN_CONTAINERS: 'ssh:scan-containers',
  SCAN_RENDER: 'render:scan-services',
  START_TUNNEL: 'tunnel:start',
  STOP_TUNNEL: 'tunnel:stop',
  STOP_ALL: 'tunnel:stop-all'
} as const
