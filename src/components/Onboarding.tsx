interface Props {
  open: boolean
  onClose: () => void
}

const STEPS = [
  { emoji: '📍', title: 'See what’s on', text: 'Live plans near you in Jaipur — badminton, football, coffee, anything.' },
  { emoji: '🙋', title: 'Tap “I’m in”', text: 'The poster approves you. No awkward cold texts.' },
  { emoji: '💬', title: 'Chat & show up', text: 'Group chat opens once you’re in. Sort the details, meet up, play.' },
]

export default function Onboarding({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="sheet-backdrop absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="sheet-panel relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 space-y-5">
        <div className="text-center space-y-1 pt-2">
          <h1 className="wordmark text-3xl">Plann'd</h1>
          <p className="text-sm text-gray-500">Find your people for today's plan. Jaipur only, for now.</p>
        </div>
        <div className="space-y-4">
          {STEPS.map((s) => (
            <div key={s.title} className="flex items-start gap-3.5">
              <span className="text-2xl w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0">
                {s.emoji}
              </span>
              <div>
                <p className="font-bold text-gray-900 text-sm">{s.title}</p>
                <p className="text-sm text-gray-500">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold"
        >
          Show me the map 🗺️
        </button>
        <p className="text-center text-xs text-gray-400 -mt-2">
          Got a plan of your own? Hit <span className="font-semibold">+</span> and post it.
        </p>
      </div>
    </div>
  )
}
