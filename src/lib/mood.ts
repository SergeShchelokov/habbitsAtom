export type Mood = {
  score: number
  label: string
  description: string
  color: string
  light: string
  shade: string
  brows?: string
  eyes: string
  mouth: string
  mouthFill?: boolean
  cheeks?: boolean
}

export const MOODS = [
  {
    score: 1, label: 'Злюсь', description: 'Всё кипит внутри.',
    color: '#ff655f', light: '#ffa18c', shade: '#b62739',
    brows: 'M47 57 L68 68 M113 57 L92 68',
    eyes: 'M51 77 Q58 83 65 79 M95 79 Q102 83 109 77',
    mouth: 'M63 106 Q79 88 98 105 Q91 117 63 106Z', mouthFill: true,
  },
  {
    score: 2, label: 'На взводе', description: 'Даже мелочи цепляют.',
    color: '#f2858c', light: '#ffc3b0', shade: '#b74967',
    brows: 'M49 60 L66 64 M94 59 Q102 54 111 61',
    eyes: 'M51 76 Q57 75 64 78 M97 77 L108 77',
    mouth: 'M65 102 Q76 97 81 101 T99 100',
  },
  {
    score: 3, label: 'Грущу', description: 'Хочется немного тишины.',
    color: '#81a8fc', light: '#bddeff', shade: '#4b61bc',
    brows: 'M48 66 Q55 67 65 59 M95 59 Q105 67 112 66',
    eyes: 'M51 77 Q58 83 65 77 M95 77 Q102 83 109 77',
    mouth: 'M66 104 Q80 92 94 104',
  },
  {
    score: 4, label: 'Тревожусь', description: 'Сложно расслабиться.',
    color: '#a78cf5', light: '#d7c4ff', shade: '#6951be',
    brows: 'M47 65 Q55 55 66 59 M94 58 Q104 55 114 65',
    eyes: 'M53 77 H62 M98 77 H107',
    mouth: 'M66 103 Q72 95 79 101 T94 101',
  },
  {
    score: 5, label: 'Спокойно', description: 'Можно просто выдохнуть.',
    color: '#cb9cf1', light: '#e5c6ff', shade: '#9065bc',
    eyes: 'M48 74 Q56 86 66 74 M94 74 Q104 86 112 74',
    mouth: 'M69 97 Q80 108 91 97',
  },
  {
    score: 6, label: 'Ровно', description: 'День идёт своим чередом.',
    color: '#9da9f0', light: '#cad5ff', shade: '#6275be',
    brows: 'M50 64 Q57 60 64 63 M96 63 Q103 60 110 64',
    eyes: 'M56 77 h1 M103 77 h1',
    mouth: 'M70 98 H90',
  },
  {
    score: 7, label: 'Мне уютно', description: 'Хорошо там, где я сейчас.',
    color: '#8acfc2', light: '#bff2e5', shade: '#46978f',
    eyes: 'M47 75 Q57 87 67 75 M93 75 Q103 87 113 75',
    mouth: 'M67 96 Q80 114 93 96', cheeks: true,
  },
  {
    score: 8, label: 'Вдохновляюсь', description: 'Хочется взяться за что-то новое.',
    color: '#b8d58a', light: '#e3f5af', shade: '#7da94c',
    brows: 'M49 62 Q57 53 64 58 M96 57 Q105 52 112 61',
    eyes: 'M56 75 h1 M103 74 h1',
    mouth: 'M65 94 Q80 106 98 90 Q89 116 75 107 Q69 104 65 94Z', mouthFill: true,
  },
  {
    score: 9, label: 'На подъёме', description: 'Есть азарт и силы действовать.',
    color: '#ff9b53', light: '#ffd3a1', shade: '#cf5e32',
    brows: 'M45 59 Q56 47 65 55 M94 55 Q104 46 116 58',
    eyes: 'M47 76 Q57 63 67 76 M93 76 Q104 63 114 76',
    mouth: 'M62 90 Q81 103 100 90 C96 122 65 122 62 90Z', mouthFill: true, cheeks: true,
  },
  {
    score: 10, label: 'Радуюсь', description: 'Хочется улыбнуться.',
    color: '#ffd453', light: '#fff09f', shade: '#eaa311',
    brows: 'M47 59 Q54 48 64 53 M96 53 Q106 48 113 59',
    eyes: 'M56 73 h1 M103 73 h1',
    mouth: 'M61 89 Q80 101 100 89 C96 121 65 123 61 89Z', mouthFill: true, cheeks: true,
  },
] as const satisfies readonly Mood[]

export type MoodScore = typeof MOODS[number]['score']
export const CALM_MOOD = MOODS[4].score
export const moodByScore = (score: number): Mood => MOODS[score - 1] ?? MOODS[4]

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
