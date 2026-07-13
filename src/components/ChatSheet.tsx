import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'
import { activityByKey, type Intent } from '../types'

interface Props {
  intent: Intent | null
  auth: Auth
  onClose: () => void
}

interface Message {
  id: string
  user_id: string
  body: string
  created_at: string
}

interface Sender {
  name: string
  emoji: string
  avatarUrl: string | null
}

export default function ChatSheet({ intent, auth, onClose }: Props) {
  const { session } = auth
  const [messages, setMessages] = useState<Message[]>([])
  const [senders, setSenders] = useState<Map<string, Sender>>(new Map())
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadSenders = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, emoji, avatar_url')
      .in('id', userIds)
    setSenders((prev) => {
      const next = new Map(prev)
      for (const p of data ?? []) {
        next.set(p.id, {
          name: p.first_name || 'Someone',
          emoji: p.emoji ?? '🙋',
          avatarUrl: p.avatar_url ?? null,
        })
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!intent || !session) return
    setMessages([])
    setError(null)

    supabase
      .from('messages')
      .select('id, user_id, body, created_at')
      .eq('intent_id', intent.id)
      .order('created_at')
      .limit(200)
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          return
        }
        const msgs = (data ?? []) as Message[]
        setMessages(msgs)
        loadSenders([...new Set(msgs.map((m) => m.user_id))])
      })

    const channel = supabase
      .channel(`chat-${intent.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `intent_id=eq.${intent.id}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          loadSenders([msg.user_id])
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [intent, session, loadSenders])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!intent || !session) return null

  const send = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    const { error: err } = await supabase
      .from('messages')
      .insert({ intent_id: intent.id, user_id: session.user.id, body })
    if (err) {
      setError(err.message)
      setDraft(body)
    }
  }

  const activity = activityByKey(intent.activity)
  const istTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    })

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl flex flex-col" style={{ height: '80%' }}>
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-3">
          <span className="text-2xl">{activity.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 truncate">{intent.title}</p>
            <p className="text-xs text-gray-500">Group chat · poster + accepted joiners</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl px-2" aria-label="Close chat">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !error && (
            <p className="text-center text-sm text-gray-400 pt-10">
              No messages yet — say hi 👋
            </p>
          )}
          {messages.map((m) => {
            const mine = m.user_id === session.user.id
            const sender = senders.get(m.user_id)
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${mine ? 'text-right' : ''}`}>
                  {!mine && (
                    <p className="text-[11px] text-gray-400 mb-0.5 px-1">
                      {sender?.emoji ?? '🙋'} {sender?.name ?? '…'}
                    </p>
                  )}
                  <div
                    className={`inline-block rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? 'bg-gray-900 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    {m.body}
                  </div>
                  <p className="text-[10px] text-gray-300 mt-0.5 px-1">{istTime(m.created_at)}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-5 pb-1 text-xs text-red-600">{error}</p>}

        <div className="p-3 border-t border-gray-100 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <input
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-900"
            placeholder="Message…"
            value={draft}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="bg-gray-900 text-white rounded-xl px-4 font-semibold text-sm disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
