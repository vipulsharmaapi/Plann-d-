import type { AppNotification } from '../hooks/useNotifications'

interface Props {
  open: boolean
  items: AppNotification[]
  onClose: () => void
  onOpenNotification: (n: AppNotification) => void
}

const ICONS: Record<AppNotification['type'], string> = {
  join_request: '🙋',
  request_accepted: '🎉',
  chat_message: '💬',
}

const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function NotificationsSheet({ open, items, onClose, onOpenNotification }: Props) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[80%] flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center">
          <h2 className="flex-1 text-lg font-bold text-gray-900">Notifications</h2>
          <button onClick={onClose} className="text-gray-400 text-xl px-2" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-12">
              Nothing yet — post a plan and they'll start rolling in 🔔
            </p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => onOpenNotification(n)}
              className={`w-full text-left px-5 py-3.5 border-b border-gray-50 flex items-start gap-3 ${
                n.read_at ? 'bg-white' : 'bg-indigo-50/60'
              }`}
            >
              <span className="text-xl shrink-0">{ICONS[n.type]}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-gray-800">{n.body}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)} ago</span>
              </span>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
