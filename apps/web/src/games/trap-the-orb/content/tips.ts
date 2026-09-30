export const TIPS: readonly string[] = [
  'Trap the orbs by dividing the space. The more area you capture, the higher your score!',
  'Right-click or press Space to switch between vertical and horizontal walls.',
  'An orb that touches a wall while it is being built breaks it — and costs you a life.',
  'Orb colours show speed: blue is calm, orange quick, red fast and violet blazing.',
  'Each half of a wall grows on its own. One half can still finish if the other breaks.',
  'Every percent you capture above the target adds a territory bonus.',
  'Clear a level before its par time to add a speed bonus to your score.',
  'Build right behind an orb that is moving away from the line — it cannot turn around in time.',
  'Box an orb into a tiny pocket to work towards the Tight Squeeze badge.',
]

export function tipForLevel(level: number): string {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1
  return TIPS[(safeLevel - 1) % TIPS.length] ?? TIPS[0] ?? ''
}
