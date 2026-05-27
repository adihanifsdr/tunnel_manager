import { Clock, X } from 'lucide-react'
import type { RecentConnection } from '../../../shared/types'

interface RecentConnectionsProps {
  recents: RecentConnection[]
  onSelect: (recent: RecentConnection) => void
  onRemove: (recent: RecentConnection) => void
}

function formatAge(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function RecentConnections({
  recents,
  onSelect,
  onRemove
}: RecentConnectionsProps): JSX.Element | null {
  if (recents.length === 0) return null

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Recent:
      </span>
      {recents.map((r) => {
        const label = `${r.user}@${r.host}:${r.port}`
        return (
          <button
            key={label}
            onClick={() => onSelect(r)}
            className="group flex items-center gap-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded px-2 py-0.5 text-xs transition-colors"
            title={`${label}\nKey: ${r.keyPath || 'default'}\n${formatAge(r.lastUsed)}`}
          >
            <span>{label}</span>
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(r)
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        )
      })}
    </div>
  )
}
