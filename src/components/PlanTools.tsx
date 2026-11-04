import { useEffect, useState } from 'react'
import { CalendarPlus, MapPin, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { downloadCalendar } from '../lib/calendar'
import type { Intent } from '../types'
export default function PlanTools({ intent, userId }: { intent: Intent; userId?: string }) {
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (userId)
      supabase
        .from('plan_reminders')
        .select('intent_id')
        .eq('intent_id', intent.id)
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setEnabled(!!data)
        })
    return () => {
      active = false
    }
  }, [intent.id, userId])
  async function toggle() {
    if (!userId || busy) return
    setBusy(true)
    setError('')
    try {
      const { error } = enabled
        ? await supabase
            .from('plan_reminders')
            .delete()
            .eq('intent_id', intent.id)
            .eq('user_id', userId)
        : await supabase.from('plan_reminders').insert({ intent_id: intent.id, user_id: userId })
      if (error) setError(error.message)
      else setEnabled(!enabled)
    } catch {
      setError('Could not update your reminder. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2 mt-3">
      <div className="flex flex-wrap gap-2">
        <button className="secondary text-xs" onClick={() => downloadCalendar(intent)}>
          <CalendarPlus size={16} />
          Add to calendar
        </button>
        <a
          className="secondary text-xs"
          href={`https://www.google.com/maps/dir/?api=1&destination=${intent.lat},${intent.lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin size={16} />
          Directions
        </a>
        {userId && (
          <button
            className="secondary text-xs"
            disabled={busy}
            aria-pressed={enabled}
            onClick={toggle}
          >
            <Bell size={16} />
            {enabled ? 'Reminder on' : 'Remind me'}
          </button>
        )}
      </div>
      {enabled && (
        <p className="text-xs text-gray-600">
          A reminder appears in your inbox 30 minutes before the start. Calendar alerts depend on
          your calendar settings.
        </p>
      )}
      <p className="text-xs text-gray-500">
        Calendar downloads do not update automatically if the plan changes.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
