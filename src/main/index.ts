import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, execFile, ChildProcess } from 'child_process'
import { createServer } from 'net'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import type { SSHConfig, AppConfig, AppMode, TunnelTarget, RecentConnection } from '../shared/types'
import { portMemoryKey } from '../shared/types'

// --- Config persistence ---
const CONFIG_PATH = join(homedir(), '.tunnel_manager.json')

function loadConfig(): AppConfig {
  const defaults: AppConfig = {
    host: '',
    user: 'root',
    port: '22',
    keyPath: '',
    mode: 'ssh',
    theme: 'dark',
    render: { apiKey: '' },
    portMemory: {}
  }
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      return {
        host: raw.host ?? defaults.host,
        user: raw.user ?? defaults.user,
        port: raw.port ?? defaults.port,
        keyPath: raw.keyPath ?? raw.key_path ?? defaults.keyPath,
        // Anything unrecognised falls back to SSH, which is what every config
        // file written before this existed means.
        mode: raw.mode === 'render' ? 'render' : 'ssh',
        theme: raw.theme === 'light' ? 'light' : 'dark',
        render: { apiKey: raw.render?.apiKey ?? '' },
        portMemory:
          raw.portMemory && typeof raw.portMemory === 'object'
            ? raw.portMemory
            : defaults.portMemory
      }
    } catch {
      // ignore corrupt config
    }
  }
  return defaults
}

/**
 * Record the port a tunnel actually opened on.
 *
 * Read-modify-write against the file rather than the caller's config, which
 * arrives from the renderer and may be a copy taken before some other change.
 * Losing a remembered port costs one retyped number, so a failure here is
 * swallowed rather than failing a tunnel that already works.
 */
function rememberPort(mode: AppMode, name: string, port: number): void {
  try {
    const config = loadConfig()
    config.portMemory[portMemoryKey(mode, name)] = port
    saveConfig(config)
  } catch {
    // not worth failing a working tunnel over
  }
}

/**
 * The port a service is most likely listening on, by what it appears to be.
 *
 * Matched against the name, because that is the only description a Render
 * service carries — its "image" is a service *type* like `private_service`.
 *
 * This exists because the alternative was worse: Render reported
 * `hoodium-mongo:10000`, and 10000 was closed while 27017 was open. A port that
 * the platform registered is not a port that the process is listening on, so a
 * well-known port for something that is obviously MongoDB is the better guess.
 * Both are still only guesses — the row is editable, and whatever works is
 * remembered.
 */
const WELL_KNOWN_PORTS: Array<[string, number]> = [
  ['mongo', 27017],
  ['postgres', 5432],
  ['postgis', 5432],
  ['mysql', 3306],
  ['mariadb', 3306],
  ['redis', 6379],
  ['valkey', 6379],
  ['memcached', 11211],
  ['elasticsearch', 9200],
  ['opensearch', 9200],
  ['clickhouse', 8123],
  ['rabbitmq', 5672],
  ['kafka', 9092],
  ['nats', 4222],
  ['minio', 9000],
  ['vault', 8200],
  ['consul', 8500],
  ['grafana', 3000],
  ['prometheus', 9090]
]

function wellKnownPort(haystack: string): number | null {
  const lower = haystack.toLowerCase()
  for (const [key, port] of WELL_KNOWN_PORTS) {
    if (lower.includes(key)) return port
  }
  return null
}

/**
 * Ports to offer for a target, best guess first.
 *
 * Order is by how much the source is worth trusting: a port that has actually
 * carried a tunnel, then what the service looks like, then what discovery
 * reported.
 */
function suggestPorts(
  config: AppConfig,
  mode: AppMode,
  name: string,
  image: string,
  discovered: TunnelTarget['ports']
): TunnelTarget['ports'] {
  const out = [...discovered]
  const push = (port: number): void => {
    const existing = out.findIndex((p) => p.port === port)
    if (existing >= 0) out.splice(existing, 1)
    out.unshift({ port, protocol: 'tcp' })
  }

  const known = wellKnownPort(`${name} ${image}`)
  if (known !== null) push(known)

  const remembered = config.portMemory?.[portMemoryKey(mode, name)]
  if (typeof remembered === 'number' && remembered > 0) push(remembered)

  return out
}

function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * The Render key to use, environment first.
 *
 * The stored key is there because it is convenient and because the file already
 * holds SSH details in plaintext. `RENDER_API_KEY` wins so a machine that should
 * not have a full-account credential sitting in a dotfile does not need one.
 */
function renderApiKey(config: AppConfig): string {
  const fromEnv = (process.env.RENDER_API_KEY || '').trim()
  if (fromEnv) return fromEnv
  const stored = (config.render?.apiKey || '').trim()
  if (!stored) throw new Error('No Render API key. Set one in the form, or export RENDER_API_KEY.')
  return stored
}

// --- Recent connections ---
const RECENTS_PATH = join(homedir(), '.tunnel_manager_recents.json')
const MAX_RECENTS = 10

function loadRecents(): RecentConnection[] {
  if (existsSync(RECENTS_PATH)) {
    try {
      const data = JSON.parse(readFileSync(RECENTS_PATH, 'utf-8'))
      if (Array.isArray(data)) return data
    } catch {
      // ignore corrupt file
    }
  }
  return []
}

function saveRecents(recents: RecentConnection[]): void {
  writeFileSync(RECENTS_PATH, JSON.stringify(recents, null, 2), 'utf-8')
}

function recentsKey(c: SSHConfig): string {
  return `${c.user}@${c.host}:${c.port}`
}

function addRecent(config: SSHConfig): RecentConnection[] {
  const recents = loadRecents()
  const key = recentsKey(config)
  const filtered = recents.filter((r) => recentsKey(r) !== key)
  const entry: RecentConnection = { ...config, lastUsed: Date.now() }
  filtered.unshift(entry)
  const trimmed = filtered.slice(0, MAX_RECENTS)
  saveRecents(trimmed)
  return trimmed
}

function removeRecent(config: SSHConfig): RecentConnection[] {
  const recents = loadRecents()
  const key = recentsKey(config)
  const filtered = recents.filter((r) => recentsKey(r) !== key)
  saveRecents(filtered)
  return filtered
}

// --- SSH helpers ---
function buildSSHArgs(config: SSHConfig, extraArgs?: string[]): string[] {
  const args: string[] = []
  const key = (config.keyPath || '').trim()
  if (key) {
    args.push('-i', key)
  }
  args.push(
    '-p',
    (config.port || '22').trim() || '22',
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'ConnectTimeout=10',
    `${(config.user || 'root').trim()}@${(config.host || '').trim()}`
  )
  if (extraArgs) {
    args.push(...extraArgs)
  }
  return args
}

function runSSHCommand(config: SSHConfig, remoteCmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = buildSSHArgs(config, [remoteCmd])
    execFile('ssh', args, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve(stdout)
    })
  })
}

// --- Discovery: Docker over SSH ---
async function scanContainers(config: AppConfig): Promise<TunnelTarget[]> {
  const output = await runSSHCommand(
    config,
    "docker ps --format '{{.ID}}|||{{.Names}}|||{{.Image}}|||{{.Ports}}|||{{.Status}}'"
  )

  const lines = output.trim().split('\n')
  const targets: TunnelTarget[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split('|||')
    if (parts.length < 5) continue

    const [containerId, name, image, portsStr, status] = parts

    const ports: TunnelTarget['ports'] = []
    if (portsStr.trim()) {
      const portRegex = /(\d+)\/(tcp|udp)/g
      let match: RegExpExecArray | null
      while ((match = portRegex.exec(portsStr)) !== null) {
        const port = parseInt(match[1], 10)
        const protocol = match[2]
        if (!ports.some((p) => p.port === port && p.protocol === protocol)) {
          ports.push({ port, protocol })
        }
      }
    }

    targets.push({
      kind: 'docker',
      id: containerId,
      name,
      image,
      ports: suggestPorts(config, 'ssh', name, image, ports),
      status
    })
  }

  return targets
}

// --- Discovery: Render.com ---

/** Only the fields this app reads. Render's payload is much larger. */
interface RenderServiceRow {
  id: string
  name: string
  type: string
  suspended?: string
  sshAddress?: string
  serviceDetails?: {
    region?: string
    plan?: string
    url?: string
    sshAddress?: string
  }
}

/**
 * Every service on the account, as forwardable targets.
 *
 * Services with no `sshAddress` are dropped rather than listed and disabled: a
 * static site has nothing to tunnel to, and a row you cannot act on is noise.
 *
 * ── About the port ───────────────────────────────────────────────────────────
 * `serviceDetails.url` on a private service looks like `my-db:10000`, and that
 * number is the port Render has registered — which is not always the port the
 * process is listening on. A real example from a live deployment: the field
 * said `10000` while MongoDB was answering on `27017`.
 *
 * So it is offered as a suggestion and the UI lets it be typed over. Guessing
 * silently would produce a tunnel that connects to nothing and an error message
 * pointing at the wrong thing.
 */
async function scanRenderServices(config: AppConfig): Promise<TunnelTarget[]> {
  const key = renderApiKey(config)

  const res = await fetch('https://api.render.com/v1/services?limit=100', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401) throw new Error('Render rejected the API key (401).')
    throw new Error(`Render API ${res.status}: ${body.slice(0, 200)}`)
  }

  const payload = (await res.json()) as Array<{ service?: RenderServiceRow } & RenderServiceRow>
  const targets: TunnelTarget[] = []

  for (const entry of payload) {
    // The list endpoint wraps each row; other endpoints do not. Accept both.
    const svc = entry.service ?? entry
    const details = svc.serviceDetails ?? {}
    const sshAddress = svc.sshAddress ?? details.sshAddress
    if (!svc.id || !sshAddress) continue

    /*
     * `url` means two different things depending on the service type, and
     * treating them alike produced nonsense: a private service reports
     * `hoodium-mongo:10000`, while a web service reports
     * `https://hoodium-api.onrender.com`. Splitting the latter on ':' yields a
     * host of `https`, which is what the first version of this listed.
     *
     * Only the `host:port` form describes something on the private network, so
     * only that form contributes a suggested port and a private hostname.
     */
    const url = details.url ?? ''
    const ports: TunnelTarget['ports'] = []
    let privateHost: string | undefined

    if (url && !url.includes('://')) {
      const [host, portText] = url.split(':')
      privateHost = host || svc.name
      const port = parseInt(portText ?? '', 10)
      if (Number.isFinite(port) && port > 0) ports.push({ port, protocol: 'tcp' })
    }

    // `not_suspended` is the normal state and says nothing worth a row's width.
    const bits = [details.region, details.plan, svc.suspended === 'suspended' ? 'suspended' : null]

    targets.push({
      kind: 'render',
      id: svc.id,
      name: svc.name,
      image: svc.type,
      status: bits.filter(Boolean).join(' · '),
      ports: suggestPorts(config, 'render', svc.name, svc.type, ports),
      sshAddress,
      privateHost
    })
  }

  return targets
}

// --- Tunnel management ---
const tunnelProcesses = new Map<string, ChildProcess>()
const tunnelPorts = new Map<string, number>()
const usedLocalPorts = new Set<number>()
const BASE_LOCAL_PORT = 10000

/**
 * How long a tunnel may take to start listening before it is called failed.
 *
 * Measured against Render's SSH gateway, which took six to ten seconds to
 * authenticate and bind. A local Docker host is usually under a second, so this
 * is sized for the slow case and costs the fast one nothing — the poll returns
 * as soon as the port answers.
 */
const TUNNEL_READY_TIMEOUT_MS = 25_000

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen({ port, host: '127.0.0.1' }, () => {
      server.close(() => resolve(true))
    })
  })
}

async function getNextLocalPort(): Promise<number> {
  for (let port = BASE_LOCAL_PORT; port <= 65535; port++) {
    if (usedLocalPorts.has(port)) continue
    if (!(await isPortFree(port))) continue
    usedLocalPorts.add(port)
    return port
  }
  throw new Error('No free local port available')
}

function releaseTunnelPort(targetId: string): void {
  const port = tunnelPorts.get(targetId)
  if (port !== undefined) {
    usedLocalPorts.delete(port)
    tunnelPorts.delete(targetId)
  }
}

async function getContainerIP(config: SSHConfig, containerId: string): Promise<string> {
  const output = await runSSHCommand(
    config,
    `docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerId}`
  )
  const ip = output.trim()
  if (!ip) throw new Error('Could not get container IP')
  return ip
}

/**
 * SSH arguments for a Render service gateway.
 *
 * Render authenticates with the SSH keys registered on the account and always
 * listens on 22, so there is no user, host or port to compose — `sshAddress` is
 * the whole of it. A key path is still honoured if one is set, for anyone whose
 * default identity is not the key they gave Render.
 */
function buildRenderSSHArgs(config: AppConfig, sshAddress: string, extraArgs: string[]): string[] {
  const args: string[] = []
  const key = (config.keyPath || '').trim()
  if (key) args.push('-i', key)
  args.push('-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=10', sshAddress, ...extraArgs)
  return args
}

/**
 * Open a tunnel to one target.
 *
 * The two modes differ in where SSH connects and what host the forward resolves
 * on the far side, and agree on everything after that — which is why the process
 * handling below is shared.
 *
 *   docker  the daemon knows the container's IP, so it is looked up first and
 *           the forward names it directly.
 *   render  see below. It is not the obvious thing.
 *
 * ── Why Render needs a separate service to tunnel through ────────────────────
 * SSH-ing into the service you want and forwarding to `localhost` is the
 * intuitive move, and it does not work. Render's own documentation is the
 * reason: "an ephemeral shell instance runs your service's image, but does not
 * receive any traffic **or run your service's start command**". The shell is a
 * fresh copy of the image with nothing running in it, so `localhost:27017` on a
 * database service is empty — the forward opens and then fails with
 * `channel N: open failed: connect failed`, which is what it did.
 *
 * Worse for a datastore: a minimal image cannot host an SSH session at all, so
 * SSH to it is closed by the remote host before a channel exists.
 *
 * What works is the private network. The shell instance resolves and reaches
 * other services — `hoodium-mongo` answered on 10.25.100.5:27017 from a web
 * service's shell — so the tunnel runs *through* a service that can hold a
 * session, and *to* the target's private hostname. Hence `via`.
 */
async function startTunnel(
  config: AppConfig,
  target: TunnelTarget,
  remotePort: number,
  via?: TunnelTarget
): Promise<{ localPort: number }> {
  let remoteHost: string
  let args: string[]

  if (target.kind === 'render') {
    const gateway = via?.sshAddress ?? target.sshAddress
    if (!gateway) {
      throw new Error(`No Render service to tunnel through — pick one under "via".`)
    }
    // The private hostname, never `localhost`: the shell instance is not the
    // running service. Falls back to the name, which is what Render's DNS uses.
    remoteHost = target.privateHost ?? target.name
    args = buildRenderSSHArgs(config, gateway, [])
  } else {
    remoteHost = await getContainerIP(config, target.id)
    args = buildSSHArgs(config, [])
  }

  const localPort = await getNextLocalPort()
  const targetId = target.id
  args.push(
    '-o',
    'ExitOnForwardFailure=yes',
    '-L',
    `${localPort}:${remoteHost}:${remotePort}`,
    '-N'
  )

  const proc = spawn('ssh', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let stderr = ''
  proc.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  /*
   * Wait for the local port to actually accept a connection.
   *
   * This used to wait two seconds and check only that the process had not
   * exited, which reports a tunnel as ready before it is: authenticating and
   * binding takes six to ten seconds against a remote gateway, and anything
   * that connected in between got `ECONNREFUSED` while the UI said "active".
   *
   * Polling the port tests the thing the caller is about to rely on. The
   * process is still watched alongside it, because an SSH that exits will never
   * bind and there is no reason to wait out the timeout to say so.
   */
  try {
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + TUNNEL_READY_TIMEOUT_MS
      let settled = false

      const finish = (err?: Error): void => {
        if (settled) return
        settled = true
        err ? reject(err) : resolve()
      }

      proc.on('error', (err) => finish(err))
      proc.on('exit', (code) =>
        finish(new Error(stderr.trim() || `SSH tunnel exited with code ${code}`))
      )

      const poll = async (): Promise<void> => {
        if (settled) return
        // A port that is no longer free is the tunnel holding it.
        if (!(await isPortFree(localPort))) return finish()
        if (Date.now() > deadline) {
          proc.kill('SIGTERM')
          return finish(new Error(stderr.trim() || 'SSH tunnel did not start listening in time'))
        }
        setTimeout(() => void poll(), 500)
      }
      void poll()
    })
  } catch (err) {
    usedLocalPorts.delete(localPort)
    throw err
  }

  // It carried a connection, so it beats every guess next time.
  rememberPort(target.kind === 'render' ? 'render' : 'ssh', target.name, remotePort)

  tunnelProcesses.set(targetId, proc)
  tunnelPorts.set(targetId, localPort)

  proc.on('exit', () => {
    if (tunnelProcesses.get(targetId) !== proc) return
    tunnelProcesses.delete(targetId)
    releaseTunnelPort(targetId)
    // A tunnel that died on its own still shows as live until the UI is told.
    send('tunnel:closed', { targetId, reason: stderr.trim().split('\n').slice(-3).join(' ') })
  })

  return { localPort }
}

function stopTunnel(targetId: string): void {
  const proc = tunnelProcesses.get(targetId)
  if (proc) {
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGKILL')
      }
    }, 5000)
    tunnelProcesses.delete(targetId)
  }
  releaseTunnelPort(targetId)
}

function stopAllTunnels(): void {
  for (const [id] of tunnelProcesses) {
    stopTunnel(id)
  }
}

// --- Electron app ---
let mainWindow: BrowserWindow | null = null

/**
 * Quitting destroys the window before the tunnels finish exiting, and each exit
 * pushes an event — so the window has to be checked for destruction, not just
 * for null, or the send throws "Object has been destroyed".
 */
function send(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1150,
    height: 760,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow = win

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // --- IPC Handlers ---
  ipcMain.handle('config:load', () => {
    return loadConfig()
  })

  ipcMain.handle('config:save', (_event, config: AppConfig) => {
    saveConfig(config)
  })

  ipcMain.handle('recents:load', () => {
    return loadRecents()
  })

  ipcMain.handle('recents:add', (_event, config: SSHConfig) => {
    return addRecent(config)
  })

  ipcMain.handle('recents:remove', (_event, config: SSHConfig) => {
    return removeRecent(config)
  })

  ipcMain.handle('ssh:scan-containers', async (_event, config: AppConfig) => {
    return await scanContainers(config)
  })

  ipcMain.handle('render:scan-services', async (_event, config: AppConfig) => {
    return await scanRenderServices(config)
  })

  ipcMain.handle(
    'tunnel:start',
    async (
      _event,
      config: AppConfig,
      target: TunnelTarget,
      remotePort: number,
      via?: TunnelTarget
    ) => {
      return await startTunnel(config, target, remotePort, via)
    }
  )

  ipcMain.handle('tunnel:stop', (_event, targetId: string) => {
    stopTunnel(targetId)
  })

  ipcMain.handle('tunnel:stop-all', () => {
    stopAllTunnels()
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopAllTunnels()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
