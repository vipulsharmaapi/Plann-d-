import type { AppNotification } from '../hooks/useNotifications'
import { formatTimestamp } from '../lib/time'
const ICONS: Record<string, string> = {
  join_request: '🙋',
  request_accepted: '🎉',
  chat_message: '💬',
  plan_updated: '🗓️',
  plan_cancelled: '✕',
  reminder: '🔔',
}
export default function NotificationsSheet({
  items,
  state,
  onOpenNotification,
  onMarkAll,
  onRetry,
  onSignIn,
  signedIn,
}: {
  items: AppNotification[]
  state: string
  onOpenNotification: (n: AppNotification) => void
  onMarkAll: () => void
  onRetry: () => void
  onSignIn: () => void
  signedIn: boolean
}) {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h1 className="text-3xl font-bold">Inbox</h1>
        {signedIn && items.some((i) => !i.read_at) && (
          <button className="secondary text-sm" onClick={onMarkAll}>
            Mark all read
          </button>
        )}
      </div>
      <p className="text-gray-600 mb-6">Requests, plan updates, messages and reminders.</p>
      {!signedIn ? (
        <button className="primary" onClick={onSignIn}>
          Sign in to see your inbox
        </button>
      ) : state === 'loading' ? (
        <p role="status">Loading your inbox…</p>
      ) : state === 'error' ? (
        <div role="alert">
          <p>Couldn’t refresh your inbox.</p>
          <button className="secondary mt-3" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl mb-4" aria-hidden="true">
            🔔
          </p>
          <h2 className="font-bold text-xl">You’re all caught up</h2>
          <p className="text-gray-600 mt-2">Updates appear here when you post or join a plan.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => onOpenNotification(n)}
              className={`w-full text-left p-4 border-b last:border-0 border-gray-100 flex items-start gap-3 ${n.read_at ? 'bg-white' : 'bg-indigo-50'}`}
            >
              <span className="text-xl" aria-hidden="true">
                {ICONS[n.type] ?? '🔔'}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{n.body}</span>
                <span className="block text-xs text-gray-600 mt-1">
                  {new Date(n.created_at).toLocaleDateString('en-IN', {
                    dateStyle: 'medium',
                    timeZone: 'Asia/Kolkata',
                  })} · {formatTimestamp(n.created_at)} IST
                </span>
              </span>
              {!n.read_at && <span className="text-xs font-bold text-indigo-700">New</span>}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-6">
        Reminders appear here while you use Plann’d. Add a plan to your calendar for alerts outside
        the app.
      </p>
    </section>
  )
}
