import { useEffect, useState } from 'react'
import type { Intent } from '../types'
import { supabase } from '../lib/supabase'

const skillLabels = {
  all: 'All levels welcome',
  beginner: 'Beginner friendly',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}
const bookingLabels = {
  not_needed: 'No booking needed',
  needed: 'Booking still to be arranged',
  confirmed: 'Booked by the host',
}

export default function PlanContext({
  intent,
  onProfile,
}: {
  intent: Intent
  onProfile: (id: string) => void
}) {
  const [host, setHost] = useState<{
    bio?: string
    avatar_url?: string
    first_name?: string
  } | null>(null)
  useEffect(() => {
    let active = true
    setHost(null)
    if (intent.userId)
      supabase
        .from('profiles')
        .select('first_name,avatar_url,bio')
        .eq('id', intent.userId)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setHost(data)
        })
    return () => {
      active = false
    }
  }, [intent.userId])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {host?.avatar_url && (
            <img src={host.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover" />
          )}
          <button
            className="text-left min-h-11 font-semibold text-sm hover:underline break-words"
            disabled={!intent.userId}
            onClick={() => intent.userId && onProfile(intent.userId)}
          >
            Hosted by {host?.first_name || intent.posterName}
          </button>
        </div>
        <span className="text-sm font-semibold text-brand-700 shrink-0">
          {intent.spotsFilled >= intent.spotsNeeded
            ? 'Full'
            : `${intent.spotsNeeded - intent.spotsFilled} spot${intent.spotsNeeded - intent.spotsFilled === 1 ? '' : 's'} left`}
        </span>
      </div>
      {intent.note && (
        <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{intent.note}</p>
      )}
      {intent.expectedCost != null || intent.skillLevel || intent.bookingStatus ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {intent.expectedCost != null && (
            <div>
              <dt className="text-gray-600">Expected cost / person</dt>
              <dd className="font-semibold mt-1">
                {intent.expectedCost === 0
                  ? 'Free'
                  : `About ₹${Number(intent.expectedCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
              </dd>
            </div>
          )}
          {intent.skillLevel && (
            <div>
              <dt className="text-gray-600">Skill level</dt>
              <dd className="font-semibold mt-1">{skillLabels[intent.skillLevel]}</dd>
            </div>
          )}
          {intent.bookingStatus && (
            <div className="col-span-2">
              <dt className="text-gray-600">Venue booking</dt>
              <dd className="font-semibold mt-1">{bookingLabels[intent.bookingStatus]}</dd>
            </div>
          )}
        </dl>
      ) : null}
      {intent.meetingInstructions && (
        <div>
          <h3 className="font-semibold text-sm">Where to meet & what to expect</h3>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
            {intent.meetingInstructions}
          </p>
        </div>
      )}
    </div>
  )
}
