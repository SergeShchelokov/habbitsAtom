const colors = [
  '#8cb8ff', '#93adff', '#a5a5fe', '#b1a0fb', '#c69bf2', '#dd95df',
  '#f296c0', '#ff9a9d', '#ffa477', '#ffb665', '#ffd453',
] as const

export const energyColor = (level: number) => colors[level] ?? colors[5]

export function energyLabel(level: number) {
  if (level <= 2) return 'Без сил'
  if (level <= 4) return 'На спаде'
  if (level <= 6) return 'Ровно'
  if (level <= 8) return 'Хороший заряд'
  return 'Полон энергии'
}
