// Display only: plan values stay as HH:mm in IST for editing, filtering and calendars.
export function formatTime(time: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) return time
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`
}

export const formatTimeRange = (start: string, end: string): string =>
  `${formatTime(start)} to ${formatTime(end)} IST`

export const formatTimestamp = (iso: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso)).replace(/\s+/g, ' ').toUpperCase()
