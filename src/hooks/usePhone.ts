import { useEffect, useState } from 'react'
export function usePhone() {
  const [phone, setPhone] = useState(
    () => window.matchMedia?.('(max-width:700px)').matches ?? false,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width:700px)')
    if (!mq) return
    const change = () => setPhone(mq.matches)
    mq.addEventListener('change', change)
    return () => mq.removeEventListener('change', change)
  }, [])
  return phone
}
