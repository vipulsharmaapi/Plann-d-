import {
  Bike,
  CircleDot,
  Clapperboard,
  Coffee,
  Dices,
  Dumbbell,
  Footprints,
  Mountain,
  Users,
  Utensils,
  Waves,
} from 'lucide-react'
import type { ActivityKey } from '../types'

const icons = {
  coffee: Coffee,
  food: Utensils,
  boardgames: Dices,
  movies: Clapperboard,
  running: Footprints,
  cycling: Bike,
  gym: Dumbbell,
  swimming: Waves,
  trekking: Mountain,
  badminton: CircleDot,
  football: CircleDot,
  cricket: CircleDot,
  tennis: CircleDot,
  basketball: CircleDot,
  other: Users,
}

export default function ActivityIcon({
  activity,
  size = 24,
}: {
  activity: ActivityKey
  size?: number
}) {
  const Icon = icons[activity] ?? Users
  return (
    <Icon
      size={size}
      strokeWidth={1.7}
      aria-hidden="true"
      className="shrink-0 text-gray-600 mt-0.5"
    />
  )
}
