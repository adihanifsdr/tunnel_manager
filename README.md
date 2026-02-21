# SSH Tunnel Manager

A desktop application for managing SSH tunnels to Docker containers on remote servers. Discover running containers, create port-forwarding tunnels with one click, and manage multiple simultaneous connections — all from a clean, minimal UI.

![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)

## Features

- **Container Discovery** — Connect to a remote server via SSH and automatically list all running Docker containers with their exposed ports
- **One-Click Tunneling** — Create SSH local port-forwarding tunnels to any container port instantly
- **Multi-Tunnel Support** — Run multiple tunnels simultaneously with automatic local port assignment (starting from port 10000)
- **Real-Time Status** — See active tunnel mappings (`localhost:PORT` → `container:PORT`) at a glance
- **Persistent Config** — SSH connection settings are saved to `~/.tunnel_manager.json` and restored on launch
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

1. Enter your SSH connection details (host, user, port, key path)
2. Click **Scan Containers** to discover running Docker containers on the remote server
3. Click the **Forward** button on any container to create an SSH tunnel to its exposed port
4. Access the container service locally at the assigned `localhost:PORT`
5. Click **Stop** on individual tunnels or **Stop All** to tear down connections

## How It Works

The app connects to your remote server over SSH and runs `docker ps` to discover containers. When you forward a port, it creates an SSH local port-forwarding tunnel (`ssh -L localPort:containerIP:remotePort`) that maps a local port to the container's exposed port. Tunnels are managed as child processes with graceful shutdown (SIGTERM, then SIGKILL after 5s).

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

SSH settings are persisted at `~/.tunnel_manager.json`:

```json
{
  "host": "your-server.com",
  "user": "root",
  "port": "22",
  "keyPath": "/path/to/ssh/key"
}
```

## License

MIT
