import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { supabase } from '../lib/supabase'
export default function HelpSheet({ userId, onClose }: { userId?: string; onClose: () => void }) {
  const [blocks, setBlocks] = useState<{ blocked_user_id: string; name: string }[]>([]),
    [reports, setReports] = useState<{ id: string; reason: string; status: string }[]>([]),
    [gender, setGender] = useState('female'),
    [reason, setReason] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    if (userId)
      Promise.all([
        supabase.from('user_blocks').select('blocked_user_id'),
        supabase
          .from('reports')
          .select('id,reason,status')
          .order('created_at', { ascending: false })
          .limit(20),
      ]).then(async ([b, r]) => {
        if (b.error || r.error) {
          if (live) setMessage('Could not load your safety settings. Reopen Help to try again.')
          return
        }
        const ids = (b.data ?? []).map((x) => x.blocked_user_id)
        const p = ids.length
          ? await supabase.from('profiles').select('id,first_name').in('id', ids)
          : { data: [] }
        if (live) {
          setBlocks(
            (b.data ?? []).map((x) => ({
              ...x,
              name: p.data?.find((y) => y.id === x.blocked_user_id)?.first_name ?? 'Member',
            })),
          )
          setReports(r.data ?? [])
        }
      })
    return () => {
      live = false
    }
  }, [userId])
  async function unblock(id: string) {
    if (!userId) return
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('user_id', userId)
      .eq('blocked_user_id', id)
    if (error) setMessage(error.message)
    else {
      setBlocks((b) => b.filter((x) => x.blocked_user_id !== id))
      window.dispatchEvent(new Event('plannd:blocks-changed'))
    }
  }
  async function correction() {
    if (!userId || busy) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('profile_change_requests')
        .insert({ user_id: userId, requested_gender: gender, reason: reason.trim() })
      setMessage(
        error
          ? error.code === '23505'
            ? 'You already have a pending correction request.'
            : error.message
          : 'Correction request sent for review.',
      )
      if (!error) setReason('')
    } catch {
      setMessage('Could not send your request. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet title="Help, privacy and safety" onClose={onClose}>
      <div className="p-6 pt-16 space-y-6 text-sm leading-relaxed">
        <h2 className="text-2xl font-bold">Help, privacy & safety</h2>
        <section className="border-b border-slate-200 pb-5">
          <h3 className="font-bold text-base mb-2">Can’t sign in or need account help?</h3>
          <p>
            Email us from an address where you can receive a reply. Include what happened and the
            email on your account, but never your password or sign-in code.
          </p>
          <a
            className="inline-flex items-center min-h-11 font-semibold underline break-all"
            href="mailto:vipulsharma86481@gmail.com?subject=Plann%E2%80%99d%20account%20help"
          >
            vipulsharma86481@gmail.com
          </a>
          <p className="text-xs text-gray-600">
            You don’t need to sign in. Requests are reviewed manually; this is not emergency
            support.
          </p>
        </section>
        <section>
          <h3 className="font-bold text-base mb-2">How plans work</h3>
          <p>
            Choose a plan and request to join. The host approves requests. Once accepted, use the
            group chat to coordinate. You can withdraw or leave from the plan details. Hosts can
            edit or cancel; affected members receive an inbox update.
          </p>
        </section>
        <section>
          <h3 className="font-bold text-base mb-2">Meet safely</h3>
          <p>
            Meet in a public place, check costs and arrangements with the host, and tell someone you
            trust where you’re going. Profiles and gender are self-declared, not identity
            verification. Use Report or block on a plan if something is wrong. This app is not an
            emergency service.
          </p>
        </section>
        <section id="privacy">
          <h3 className="font-bold text-base mb-2">Your privacy</h3>
          <p>
            Your name, avatar and posted plan details are public. Email sign-in and app data are
            stored using Supabase. Your optional WhatsApp number is shared only between a host and
            an accepted participant; group links and chat are restricted to participants. Avoid
            posting private addresses or sensitive details in public plans.
          </p>
          <p className="mt-2">
            Location permission is optional and used in your browser for nearby sorting. Map and
            venue-search providers (Google Maps, OpenStreetMap and Photon) receive requests needed
            to show maps, search places and display venue photos and ratings. Ratings and photos are
            loaded from Google when you browse places or open a plan; menu links are supplied by
            hosts. Uploaded avatars are public. Browser storage keeps your sign-in session. Signing
            out clears the app session. Google Maps is subject to{' '}
            <a
              href="https://www.google.com/intl/en_us/help/terms_maps/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Google’s terms
            </a>{' '}
            and{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              privacy policy
            </a>
            .
          </p>
          <p className="mt-2">
            Reports and correction requests are visible to you and the project’s administrators. For
            an account or data-removal request, use the support email above or, when signed in,
            submit a private request below. The team reviews requests manually; no response time is
            guaranteed.
          </p>
        </section>
        {userId && (
          <>
            <section>
              <h3 className="font-bold text-base mb-2">Blocked members</h3>
              {blocks.length ? (
                blocks.map((b) => (
                  <div key={b.blocked_user_id} className="flex justify-between items-center gap-3">
                    <span>{b.name}</span>
                    <button
                      className="secondary text-xs"
                      onClick={() => unblock(b.blocked_user_id)}
                    >
                      Unblock
                    </button>
                  </div>
                ))
              ) : (
                <p>No members blocked.</p>
              )}
              <p className="mt-2 text-xs text-gray-600">
                Unblocking does not restore previous requests or chat membership.
              </p>
            </section>
            <section>
              <h3 className="font-bold text-base mb-2">Your reports</h3>
              {reports.length ? (
                reports.map((r) => (
                  <p key={r.id} className="py-2 border-b border-gray-100">
                    <span className="font-semibold capitalize">{r.status}</span> · {r.reason}
                  </p>
                ))
              ) : (
                <p>No reports submitted.</p>
              )}
            </section>
            <section className="space-y-3">
              <h3 className="font-bold text-base">Correct your profile</h3>
              <p>Gender is self-declared. Request a correction if the saved value is wrong.</p>
              <label className="field">
                Correct gender
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                Reason
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </label>
              <button
                className="secondary"
                disabled={busy || reason.trim().length < 5}
                onClick={correction}
              >
                Request correction
              </button>
            </section>
            <PrivateRequest userId={userId} onMessage={setMessage} />
          </>
        )}
        {message && (
          <p role="status" className="p-3 rounded-xl bg-gray-100">
            {message}
          </p>
        )}
      </div>
    </Sheet>
  )
}
function PrivateRequest({ userId, onMessage }: { userId: string; onMessage: (s: string) => void }) {
  const [text, setText] = useState(''),
    [busy, setBusy] = useState(false)
  async function send() {
    setBusy(true)
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: userId,
        intent_id: null,
        reason: 'Account/help request: ' + text.trim(),
      })
      onMessage(
        error
          ? error.message
          : 'Your private request has been sent. Its review status appears under Your reports.',
      )
      if (!error) setText('')
    } catch {
      onMessage('Could not send. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-3">
      <label className="field">
        Private help or account request
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={900}
          placeholder="Describe the help you need. Do not include passwords."
        />
      </label>
      <button className="secondary" disabled={busy || text.trim().length < 5} onClick={send}>
        {busy ? 'Sending…' : 'Send private request'}
      </button>
    </section>
  )
}
