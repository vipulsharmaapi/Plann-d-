import { CalendarDays, Inbox } from 'lucide-react'
export default function AccountGate({
  inbox = false,
  onSignIn,
  onExplore,
}: {
  inbox?: boolean
  onSignIn: () => void
  onExplore: () => void
}) {
  const Icon = inbox ? Inbox : CalendarDays
  return (
    <div className="account-gate">
      <span className="account-gate-icon">
        <Icon size={28} />
      </span>
      <h2>{inbox ? 'Your conversations start here.' : 'Keep your plans in one place.'}</h2>
      <p>
        {inbox
          ? 'Sign in to see join requests, plan updates and messages.'
          : 'Sign in to see the plans you join, host and save, all together.'}
      </p>
      <button className="primary" onClick={onSignIn}>
        Sign in
      </button>
      <button className="text-button" onClick={onExplore}>
        Keep exploring
      </button>
      <small>You can browse Jaipur plans and venues without an account.</small>
    </div>
  )
}
