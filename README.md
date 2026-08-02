# SSH Tunnel Manager

A desktop application for managing SSH port-forwarding tunnels, in two modes: to **Docker containers** on a remote server, or to **Render.com services**. Discover what is running, forward a port with one click, and manage multiple simultaneous tunnels — all from a clean, minimal UI.

![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)

## Two modes

Every tunnel here is `ssh -L <local>:<host>:<port>`. The mode changes only where the list of things to forward comes from, and which SSH endpoint the tunnel runs over.

| | **SSH / Docker** | **Render.com** |
|---|---|---|
| Discovery | `docker ps` over SSH | `GET /v1/services` on the Render API |
| Auth | your SSH key, to your server | Render API key + the SSH keys on your Render account |
| Tunnel endpoint | `user@host` | `srv-xxxxx@ssh.<region>.render.com` |
| Forwards to | the container's IP on the Docker network | the target's **private hostname**, over Render's private network |

Render's SSH gives you a shell in an image, not a Docker host — there is no daemon to ask what is running, which is why discovery goes through the API. Services without an SSH address (static sites) are not listed, because there is nothing to tunnel to.

### Why Render tunnels go *through* one service to reach another

The intuitive move — SSH into the database and forward to `localhost` — does not work, and Render's own docs say why:

> An ephemeral shell instance runs your service's image, but does not receive any traffic **or run your service's start command**.

The shell is a fresh copy of the image with nothing running in it, so `localhost:27017` on a database service is empty; the forward opens and then fails with `channel N: open failed: connect failed`. A minimal datastore image is worse — it cannot host an SSH session at all, and the connection is closed before a channel exists.

What does work is the private network. From a web service's shell, `hoodium-mongo` resolves and answers on port 27017. So the app asks you to pick a service to **tunnel via** — one that can hold a session, meaning a web service or a background worker — and forwards to the target's private hostname from there.

## Features

- **Two discovery modes** — Docker containers over SSH, or Render.com services over the API
- **Editable ports** — Discovery suggests a port; you can forward any port. On Render this matters: the port a service registers with the platform is not always the port the process listens on
- **One-Click Tunneling** — Create SSH local port-forwarding tunnels instantly
- **Multi-Tunnel Support** — Run multiple tunnels simultaneously with automatic local port assignment (starting from port 10000)
- **Real-Time Status** — See active tunnel mappings (`localhost:PORT` → `target:PORT`) at a glance
- **Persistent Config** — Mode, SSH settings and Render API key are saved to `~/.tunnel_manager.json` and restored on launch
- **Key-Based Auth** — Supports SSH key authentication with custom key paths

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm or pnpm
- SSH access to a remote server running Docker

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Usage

### SSH / Docker mode

1. Enter your SSH connection details (host, user, port, key path)
2. Click **Scan Containers** to discover running Docker containers on the remote server
3. Adjust the port if you want one other than the suggested first exposed port, then click **Forward**
4. Access the service locally at the assigned `localhost:PORT`
5. Click **Stop** on individual tunnels or **Stop All** to tear down connections

### Render.com mode

1. Add your SSH **public** key to Render — Account Settings → SSH Public Keys. Tunnels authenticate with it, not with the API key
2. Paste a Render API key into the form (or set `RENDER_API_KEY` in the environment, which takes precedence)
3. Click **Scan Services**
4. Check **Tunnel via** — it defaults to a web service, then a worker. Do not pick the datastore you are trying to reach; see above
5. Set the port and click **Forward**

SSH access requires a paid instance type; free services cannot be tunnelled to.

The port field is pre-filled with a best guess, in this order:

1. **The port that last worked** for that target — remembered in `portMemory` after any successful tunnel
2. **A well-known port** matched from the name (`…-mongo` → 27017, `…-postgres` → 5432, and so on)
3. **What the service registered** with Render or exposed in Docker

The well-known port outranks Render's because Render's is not reliable: a live example had Render reporting `hoodium-mongo:10000` while 10000 was closed and MongoDB answered on 27017. All three are still guesses — the field is editable, and whatever you type is what gets remembered.

Example, reaching a private MongoDB through a web service:

```bash
ssh -N -L 27024:hoodium-mongo:27017 srv-xxxxx@ssh.singapore.render.com
# then: mongodb://127.0.0.1:27024/mydb?directConnection=true
```

`directConnection=true` matters for replica sets: without it the driver follows the set's advertised internal hostnames and tries to resolve them locally.

## How It Works

**SSH / Docker** — the app connects to your server over SSH and runs `docker ps`. Forwarding looks up the container's IP with `docker inspect`, then runs `ssh -L localPort:containerIP:remotePort`.

**Render.com** — the app calls the Render API for your services and reads each one's `sshAddress`. Forwarding runs `ssh -L localPort:privateHost:remotePort srv-xxxxx@ssh.<region>.render.com`, where the SSH endpoint is the service you chose to tunnel via and `privateHost` belongs to the service you are reaching.

Both paths share everything after that: automatic local port assignment, and graceful shutdown (SIGTERM, then SIGKILL after 5s). A new tunnel is not reported as ready until its local port actually accepts a connection — against Render that takes six to ten seconds, and the older fixed two-second check reported success while connections were still being refused.

## Tech Stack

- **Electron** — Cross-platform desktop runtime
- **React** — UI framework
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **shadcn/ui** — UI components (Radix UI)
- **electron-vite** — Build tooling
- **Lucide React** — Icons

## Project Structure

```
src/
├── main/index.ts           # Electron main process, IPC handlers, SSH operations
├── preload/index.ts         # Secure API bridge between main and renderer
├── renderer/src/
│   ├── App.tsx              # Root component, state management
│   ├── components/
│   │   ├── ConnectionForm   # SSH config input form
│   │   ├── ContainerList    # Container list with status display
│   │   ├── ContainerRow     # Individual container with tunnel controls
│   │   └── ui/              # Reusable shadcn components
│   └── lib/utils.ts         # Utility functions
└── shared/types.ts          # Shared TypeScript interfaces
```

## Configuration

Settings are persisted at `~/.tunnel_manager.json`:

```json
{
  "mode": "ssh",
  "host": "your-server.com",
  "user": "root",
  "port": "22",
  "keyPath": "/path/to/ssh/key",
  "render": { "apiKey": "rnd_..." },
  "portMemory": { "render:hoodium-mongo": 27017 }
}
```

`portMemory` is keyed by `mode:name` — by name rather than id, because a Docker container id changes every time the container is recreated and the port does not.

`mode` is `"ssh"` or `"render"`; anything else — including a config file written before Render mode existed — is read as `"ssh"`. The SSH fields stay at the top level for the same reason.

**The Render API key is stored in plaintext**, like every other field in this file, and it is a full-account credential. `RENDER_API_KEY` in the environment overrides the stored value and is the better place for it on any machine someone else can read.

## Security Considerations

This application executes SSH commands and manages network tunnels. Be aware of the following:

### Known Limitations

- **SSH Host Key Verification Disabled** — `StrictHostKeyChecking=no` is used for convenience. This makes connections vulnerable to Man-in-the-Middle attacks. Use only on trusted networks.
- **No Input Sanitization** — SSH config fields (host, port, user, key path) are not validated. Ensure you only enter trusted values.
- **Command Injection Risk** — Docker container IDs are interpolated into shell commands on the remote server. This is safe under normal usage but could be exploited if a container ID is tampered with.
- **Sandbox Disabled** — Electron's renderer sandbox is turned off (`sandbox: false`) to support the preload bridge. This reduces process isolation.
- **Plaintext Config** — SSH connection settings in `~/.tunnel_manager.json` are stored unencrypted with default file permissions. Avoid storing this file on shared or unprotected systems.
- **Render API Key at Rest** — the same applies to the Render key, and it is worse: it grants full access to your Render account, not to one server. Use `RENDER_API_KEY` in the environment instead where that matters, and rotate the key if the file is ever exposed.
- **Error Messages Exposed** — Raw SSH stderr output is displayed in the UI, which may reveal server details.

### Recommendations

- Run the app only on machines you control
- Use SSH keys with passphrases for authentication
- Do not use this app over untrusted networks without addressing host key verification
- Keep your SSH private key permissions restricted (`chmod 600`)

## License

MIT
