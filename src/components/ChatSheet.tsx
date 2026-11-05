import Avatar from './Avatar'
import { mergeMessages, type Message } from '../lib/messages'
import { formatTimestamp } from '../lib/time'
import Sheet from './Sheet'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'
import { activityByKey, type Intent } from '../types'

interface Props {
  intent: Intent | null
  auth: Auth
  onClose: () => void
}

interface Sender {
  name: string
  emoji: string
  avatarUrl: string | null
}

// Make http(s) URLs clickable; split-with-capture alternates text/url parts.
// Only https?:// is linkified, so javascript: and friends stay inert text.
const URL_RE = /(https?:\/\/[^\s<>"']+)/g
const renderBody = (text: string) =>
  text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 break-all"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )

export default function ChatSheet({ intent, auth, onClose }: Props) {
  const { session } = auth
  const [messages, setMessages] = useState<Message[]>([])
  const [senders, setSenders] = useState<Map<string, Sender>>(new Map())
  const [reads, setReads] = useState<Map<string, string>>(new Map()) // user_id → last_read_at
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasOlder, setHasOlder] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  const [allowed, setAllowed] = useState(true)
  const skipScroll = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Advance my read cursor (also drives others' "Seen" indicators)
  const touchRead = useCallback(async () => {
    if (!intent || !session || document.visibilityState !== 'visible') return
    await supabase.from('chat_reads').upsert({
      intent_id: intent.id,
      user_id: session.user.id,
      last_read_at: new Date().toISOString(),
    })
  }, [intent, session])

  useEffect(() => {
    if (!intent || !session) return
    let active = true
    setLoading(true)
    setAllowed(true)
    setDraft('')
    setMessages([])
    setReads(new Map())
    setReplyTo(null)
    setError(null)

    supabase
      .from('messages')
      .select('id, user_id, body, created_at, reply_to')
      .eq('intent_id', intent.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (!active) return
        setLoading(false)
        if (err) {
          setError(err.message)
          return
        }
        const msgs = (data ?? []) as Message[]
        setMessages((previous) => mergeMessages(previous, msgs))
        setHasOlder(msgs.length === 50)
        loadSenders([...new Set(msgs.map((m) => m.user_id))])
        touchRead()
      })

    supabase
      .from('chat_reads')
      .select('user_id, last_read_at')
      .eq('intent_id', intent.id)
      .then(({ data }) => {
        setReads(new Map((data ?? []).map((r) => [r.user_id, r.last_read_at])))
        loadSenders((data ?? []).map((r) => r.user_id))
      })

    const channel = supabase
      .channel(`chat-${intent.id}` + '-' + crypto.randomUUID())
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
          setMessages((prev) => mergeMessages(prev, [msg]))
          loadSenders([msg.user_id])
          touchRead()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_reads',
          filter: `intent_id=eq.${intent.id}`,
        },
        (payload) => {
          const row = payload.new as { user_id?: string; last_read_at?: string }
          if (row.user_id && row.last_read_at) {
            setReads((prev) => new Map(prev).set(row.user_id!, row.last_read_at!))
          }
        },
      )
      .subscribe()
    const checkAccess = async () => {
      const { data, error } = await supabase.rpc('is_intent_participant', {
        p_intent_id: intent.id,
        p_user: session.user.id,
      })
      if (active && !error && !data) {
        setAllowed(false)
        setMessages([])
        setError('You no longer have access to this chat.')
      }
    }
    checkAccess()
    const timer = setInterval(checkAccess, 30000)
    window.addEventListener('focus', checkAccess)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', checkAccess)
      supabase.removeChannel(channel)
    }
  }, [intent, session, loadSenders, touchRead])

  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  if (!intent || !session) return null

  const loadOlder = async () => {
    const oldest = messages[0]
    if (!oldest || olderBusy) return
    setOlderBusy(true)
    const height = scrollRef.current?.scrollHeight ?? 0
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id,user_id,body,created_at,reply_to')
        .eq('intent_id', intent.id)
        .or(
          `created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`,
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(50)
      if (error) throw error
      const older = (data ?? []) as Message[]
      skipScroll.current = true
      setMessages((prev) => mergeMessages(prev, older))
      setHasOlder(older.length === 50)
      loadSenders([...new Set(older.map((m) => m.user_id))])
      requestAnimationFrame(() => {
        if (scrollRef.current)
          scrollRef.current.scrollTop += scrollRef.current.scrollHeight - height
      })
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load older messages.')
    } finally {
      setOlderBusy(false)
    }
  }
  const send = async () => {
    const body = draft.trim()
    if (!body || busy || !allowed) return
    setBusy(true)
    setError(null)
    const reply = replyTo
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          intent_id: intent.id,
          user_id: session.user.id,
          body,
          reply_to: reply?.id ?? null,
        })
        .select('id,user_id,body,created_at,reply_to')
        .single()
      if (error) throw error
      setDraft('')
      setReplyTo(null)
      setMessages((prev) => mergeMessages(prev, [data as Message]))
      touchRead()
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not send. Your message is still here.')
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const startReply = (m: Message) => {
    setReplyTo(m)
    inputRef.current?.focus()
  }

  const activity = activityByKey(intent.activity)
  const senderName = (userId: string) =>
    userId === session.user.id ? 'You' : (senders.get(userId)?.name ?? '…')

  // "Seen" goes under my LAST message that others have read past
  const lastMineId = [...messages].reverse().find((m) => m.user_id === session.user.id)?.id
  const seenNamesFor = (m: Message): string[] =>
    [...reads.entries()]
      .filter(([uid, at]) => uid !== session.user.id && at >= m.created_at)
      .map(([uid]) => senders.get(uid)?.name ?? 'Someone')

  const quotedOf = (m: Message): Message | undefined =>
    m.reply_to ? messages.find((x) => x.id === m.reply_to) : undefined

  return (
    <Sheet title="Group chat" onClose={onClose}>
      <div className="chat-panel relative w-full bg-white flex flex-col">
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

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {loading && (
            <p role="status" className="text-sm text-center">
              Loading messages…
            </p>
          )}
          {hasOlder && (
            <button disabled={olderBusy} className="secondary w-full text-xs" onClick={loadOlder}>
              {olderBusy ? 'Loading…' : 'Load older messages'}
            </button>
          )}
          {messages.length === 0 && !loading && !error && (
            <p className="text-center text-sm text-gray-400 pt-10">No messages yet.</p>
          )}
          {messages.map((m) => {
            const mine = m.user_id === session.user.id
            const sender = senders.get(m.user_id)
            const quoted = quotedOf(m)
            const seenNames = m.id === lastMineId ? seenNamesFor(m) : []
            return (
              <div key={m.id} className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${mine ? 'text-right' : ''}`}>
                  {!mine && (
                    <p className="text-xs text-gray-600 mb-1 px-1 flex items-center gap-2">
                      <Avatar
                        userId={m.user_id}
                        name={sender?.name}
                        url={sender?.avatarUrl}
                        emoji={sender?.emoji}
                        size={28}
                      />{' '}
                      {sender?.name ?? 'Member'}
                    </p>
                  )}
                  <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                    <div
                      className={`inline-block rounded-2xl px-3.5 py-2 text-sm break-words text-left ${
                        mine
                          ? 'bg-gray-900 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}
                    >
                      {quoted !== undefined || m.reply_to ? (
                        <div
                          className={`mb-1.5 border-l-2 pl-2 text-xs rounded-sm ${
                            mine ? 'border-gray-500 text-gray-300' : 'border-gray-300 text-gray-500'
                          }`}
                        >
                          <span className="font-semibold">
                            {quoted ? senderName(quoted.user_id) : 'Earlier message'}
                          </span>
                          {quoted && (
                            <span className="block truncate max-w-[220px]">{quoted.body}</span>
                          )}
                        </div>
                      ) : null}
                      {renderBody(m.body)}
                    </div>
                    <button
                      onClick={() => startReply(m)}
                      className="opacity-100 text-gray-400 hover:text-gray-600 text-sm shrink-0 pb-1"
                      aria-label={`Reply to ${senderName(m.user_id)}`}
                    >
                      ↩
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-300 mt-0.5 px-1">
                    {formatTimestamp(m.created_at)} IST
                    {seenNames.length > 0 && (
                      <span className="text-blue-400 font-semibold">
                        {' '}
                        · ✓✓ Seen
                        {seenNames.length > 1 ? ` by ${seenNames.length}` : ` by ${seenNames[0]}`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p role="alert" className="px-5 pb-1 text-xs text-red-600">
            {error}
          </p>
        )}

        {replyTo && (
          <div className="mx-3 mb-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-gray-400">↩</span>
            <span className="flex-1 min-w-0 truncate text-gray-600">
              <span className="font-semibold">{senderName(replyTo.user_id)}:</span> {replyTo.body}
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-gray-400 px-1"
              aria-label="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}

        <div
          className="p-3 border-t border-gray-100 flex gap-2"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <input
            aria-label="Message"
            disabled={busy || !allowed}
            ref={inputRef}
            className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-900"
            placeholder={replyTo ? `Reply to ${senderName(replyTo.user_id)}…` : 'Message…'}
            value={draft}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || busy || !allowed}
            className="bg-gray-900 text-white rounded-xl px-4 font-semibold text-sm disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
