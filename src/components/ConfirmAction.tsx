import Sheet from './Sheet'

export interface Confirmation {
  title: string
  description: string
  label: string
  action: () => void
}

export default function ConfirmAction({
  confirmation,
  onClose,
}: {
  confirmation: Confirmation
  onClose: () => void
}) {
  return (
    <Sheet title={confirmation.title} onClose={onClose}>
      <div className="sheet-panel relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pt-16 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">{confirmation.title}</h2>
        <p className="text-sm text-gray-700">{confirmation.description}</p>
        <div className="flex flex-wrap gap-3">
          <button className="secondary" onClick={onClose}>
            Go back
          </button>
          <button
            className="primary"
            onClick={() => {
              onClose()
              confirmation.action()
            }}
          >
            {confirmation.label}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
