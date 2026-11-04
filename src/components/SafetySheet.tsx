import { useState } from 'react'
import Sheet from './Sheet'
import { supabase } from '../lib/supabase'
import type { Intent } from '../types'
export default function SafetySheet({
  intent,
  userId,
  onClose,
  onBlocked,
}: {
  intent: Intent
  userId: string
  onClose: () => void
  onBlocked: () => void
}) {
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [block, setBlock] = useState(false)
  async function submit() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      if (block && intent.userId) {
        const { error } = await supabase
          .from('user_blocks')
          .upsert({ user_id: userId, blocked_user_id: intent.userId }, { ignoreDuplicates: true })
        if (error) throw error
        window.dispatchEvent(new Event('plannd:blocks-changed'))
        onBlocked()
      }
      if (reason.trim().length >= 5) {
        const { error } = await supabase
          .from('reports')
          .insert({ reporter_id: userId, intent_id: intent.id, reason: reason.trim() })
        if (error) throw error
      }
      setMessage(
        block
          ? 'Blocked. Shared requests have been closed.'
          : 'Report sent. You can check its status in Help.',
      )
      setReason('')
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : ((e as { message?: string }).message ?? 'Could not save. Try again.'),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet title="Report or block" onClose={onClose}>
      <div className="p-6 pt-16 space-y-4">
        <h2 className="text-xl font-bold">Report or block</h2>
        <p className="text-sm text-gray-600">
          Reports are private and reviewed by the Plann’d team. For immediate danger, contact local
          emergency services.
        </p>
        <label className="field">
          What happened?
          <textarea
            rows={4}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the issue (at least 5 characters)"
          />
        </label>
        {intent.userId && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
            <span>
              Block {intent.posterName}. Hide their plans and messages, close shared requests, and
              prevent new requests between you. Manage blocks in Help.
            </span>
          </label>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        <button
          className="primary w-full"
          disabled={busy || (!block && reason.trim().length < 5)}
          onClick={submit}
        >
          {busy ? 'Saving…' : block ? 'Block and save' : 'Send report'}
        </button>
      </div>
    </Sheet>
  )
}
