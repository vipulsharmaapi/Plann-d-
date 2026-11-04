import type { Intent } from '../types'
const escape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const stamp = (s: string) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
// RFC 5545 folds at 75 octets, not 75 JavaScript characters.
export function foldCalendarLine(line: string) {
  const result: string[] = []
  let part = ''
  let bytes = 0
  for (const char of line) {
    const size = new TextEncoder().encode(char).length
    if (bytes + size > 75) {
      result.push(part)
      part = ' '
      bytes = 1
    }
    part += char
    bytes += size
  }
  return [...result, part].join('\r\n')
}
export function createCalendar(intent: Intent, origin: string, now = new Date()) {
  const start = intent.startsAtIso ?? `${intent.date}T${intent.startsAt}:00+05:30`
  const end = intent.endsAtIso ?? `${intent.date}T${intent.endsAt}:00+05:30`
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Plannd//Plans//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${intent.id}@plannd`,
      `DTSTAMP:${stamp(now.toISOString())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(intent.title)}`,
      `LOCATION:${escape(intent.venueName)}`,
      `DESCRIPTION:${escape((intent.note ? intent.note + '\n' : '') + 'Check the plan for changes: ' + origin + '/?p=' + intent.id)}`,
      `URL:${origin}/?p=${intent.id}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Your Plann’d activity starts soon',
      'TRIGGER:-PT30M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(foldCalendarLine)
      .join('\r\n') + '\r\n'
  )
}
export function downloadCalendar(intent: Intent) {
  const url = URL.createObjectURL(
    new Blob([createCalendar(intent, location.origin)], { type: 'text/calendar;charset=utf-8' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `plannd-${intent.id}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
