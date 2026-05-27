import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, execFile, ChildProcess } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import type { SSHConfig, ContainerInfo, RecentConnection } from '../shared/types'

// --- Config persistence ---
const CONFIG_PATH = join(homedir(), '.tunnel_manager.json')

function loadConfig(): SSHConfig {
  const defaults: SSHConfig = { host: '', user: 'root', port: '22', keyPath: '' }
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      return {
        host: raw.host ?? defaults.host,
        user: raw.user ?? defaults.user,
        port: raw.port ?? defaults.port,
        keyPath: raw.keyPath ?? raw.key_path ?? defaults.keyPath
      }
    } catch {
      // ignore corrupt config
    }
  }
  return defaults
}

function saveConfig(config: SSHConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
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

// --- Container scanning ---
async function scanContainers(config: SSHConfig): Promise<ContainerInfo[]> {
  const output = await runSSHCommand(
    config,
    "docker ps --format '{{.ID}}|||{{.Names}}|||{{.Image}}|||{{.Ports}}|||{{.Status}}'"
  )

  const lines = output.trim().split('\n')
  const containers: ContainerInfo[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split('|||')
    if (parts.length < 5) continue

    const [containerId, name, image, portsStr, status] = parts

    const ports: ContainerInfo['ports'] = []
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

    containers.push({ containerId, name, image, ports, status })
  }

  return containers
}

// --- Tunnel management ---
const tunnelProcesses = new Map<string, ChildProcess>()
const usedLocalPorts = new Set<number>()
let nextLocalPort = 10000

function getNextLocalPort(): number {
  let port = nextLocalPort
  while (usedLocalPorts.has(port)) {
    port++
  }
  usedLocalPorts.add(port)
  nextLocalPort = port + 1
  return port
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

async function startTunnel(
  config: SSHConfig,
  containerId: string,
  remotePort: number
): Promise<{ localPort: number }> {
  const containerIP = await getContainerIP(config, containerId)
  const localPort = getNextLocalPort()

  const args = buildSSHArgs(config, ['-L', `${localPort}:${containerIP}:${remotePort}`, '-N'])

  const proc = spawn('ssh', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Wait 2 seconds to verify tunnel started
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (proc.exitCode !== null) {
        reject(new Error('SSH tunnel process exited immediately'))
      } else {
        resolve()
      }
    }, 2000)

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    proc.on('exit', (code) => {
      if (code !== null) {
        clearTimeout(timer)
        reject(new Error(`SSH tunnel exited with code ${code}`))
      }
    })
  })

  tunnelProcesses.set(containerId, proc)
  return { localPort }
}

function stopTunnel(containerId: string): void {
  const proc = tunnelProcesses.get(containerId)
  if (proc) {
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGKILL')
      }
    }, 5000)
    tunnelProcesses.delete(containerId)
  }
  // Release port — find the local port from args isn't needed since we track by containerId
  // The port will be available for reuse once we clear used ports properly
}

function stopAllTunnels(): void {
  for (const [id] of tunnelProcesses) {
    stopTunnel(id)
  }
  usedLocalPorts.clear()
}

// --- Electron app ---
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
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

  ipcMain.handle('config:save', (_event, config: SSHConfig) => {
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

  ipcMain.handle('ssh:scan-containers', async (_event, config: SSHConfig) => {
    return await scanContainers(config)
  })

  ipcMain.handle(
    'ssh:start-tunnel',
    async (_event, config: SSHConfig, containerId: string, remotePort: number) => {
      return await startTunnel(config, containerId, remotePort)
    }
  )

  ipcMain.handle('ssh:stop-tunnel', (_event, containerId: string) => {
    stopTunnel(containerId)
  })

  ipcMain.handle('ssh:stop-all', () => {
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
