export interface Message {
  id: string
  user_id: string
  body: string
  created_at: string
  reply_to: string | null
}
export function mergeMessages(previous: Message[], incoming: Message[]) {
  const byId = new Map(previous.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )
}
