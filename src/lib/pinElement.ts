import { activityByKey, type ActivityKey } from '../types'

// Shared emoji map pin, used by both the Google and MapLibre map views.
export function createPinEl(activityKey: ActivityKey, selected: boolean): HTMLElement {
  const activity = activityByKey(activityKey)
  const el = document.createElement('div')
  el.className = 'intent-pin'
  el.style.cssText = `
    width: ${selected ? 44 : 36}px; height: ${selected ? 44 : 36}px;
    border-radius: 50% 50% 50% 4px;
    background: ${activity.color};
    border: 2.5px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    font-size: ${selected ? 20 : 16}px;
    transform: rotate(-45deg);
  `
  const inner = document.createElement('span')
  inner.textContent = activity.emoji
  inner.style.transform = 'rotate(45deg)'
  el.appendChild(inner)
  return el
}
