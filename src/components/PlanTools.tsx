import { useEffect, useState } from 'react'
import { CalendarPlus, MapPin, Bell, ChevronDown } from 'lucide-react'
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
    <details className="plan-disclosure">
      <summary>
        Plan tools
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="space-y-3 pb-4">
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
            In-app reminder 30 minutes before the start. Calendar alerts use your calendar settings.
          </p>
        )}
        <p className="text-xs text-gray-500">Download the calendar again if the plan changes.</p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </details>
  )
}
