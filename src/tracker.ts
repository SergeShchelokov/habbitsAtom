export const GOAL = 21
export const STORE_KEY = 'hab21:tracker:v1'
export const MINUTES = [15, 30] as const
export type Minutes = typeof MINUTES[number]
export type Charge = { id: string; at: number; day: string }
export type Habit = { id: string; name: string; note: string; dailyLimit: 1 | 2 | 3; charges: Charge[] }
export type Energy = { id: string; at: number; score: number; note: string; kind?: 'mood' }
export type Idea = { id: string; at: number; title: string; text: string }
export type Focus = { minutes: Minutes; remaining: number; deadline: number | null; finished: boolean }
export type Tracker = { version: 1; habits: Habit[]; energy: Energy[]; ideas: Idea[]; focus: Focus }
export const newFocus = (minutes: Minutes = 15): Focus => ({ minutes, remaining: minutes * 60_000, deadline: null, finished: false })
export const newTracker = (): Tracker => ({ version: 1, habits: [], energy: [], ideas: [], focus: newFocus() })
export const dayKey = (at = Date.now()) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
const id = () => crypto.randomUUID()
const isText = (value: unknown, max: number, required = false) => typeof value === 'string' && value.length <= max && (!required || !!value.trim())
export function loadTracker(store: Pick<Storage, 'getItem'>): Tracker {
  const raw = store.getItem(STORE_KEY)
  if (!raw) return newTracker()
  const d = JSON.parse(raw) as Tracker
  const instant = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 8.64e15
  if (!d || d.version !== 1 || !Array.isArray(d.habits) || !Array.isArray(d.energy) || !Array.isArray(d.ideas) || !d.focus ||
      !MINUTES.includes(d.focus.minutes) || !instant(d.focus.remaining) || d.focus.remaining > d.focus.minutes * 60_000 ||
      (d.focus.deadline !== null && !instant(d.focus.deadline)) || typeof d.focus.finished !== 'boolean' ||
      !d.habits.every(h => h && isText(h.id, 80, true) && isText(h.name, 80, true) && isText(h.note, 200) && [1, 2, 3].includes(h.dailyLimit) &&
        Array.isArray(h.charges) && h.charges.length <= GOAL && h.charges.every(c => c && isText(c.id, 80, true) && instant(c.at) && isText(c.day, 32, true))) ||
      !d.energy.every(e => e && isText(e.id, 80, true) && instant(e.at) && Number.isInteger(e.score) && e.score >= 0 && e.score <= 10 &&
        (e.kind === undefined || (e.kind === 'mood' && e.score >= 1)) && isText(e.note, 500)) ||
      !d.ideas.every(i => i && isText(i.id, 80, true) && instant(i.at) && isText(i.title, 100, true) && isText(i.text, 4000, true))) {
    throw new Error('Не удалось прочитать сохранённые данные.')
  }
  return d
}
export function createHabit(name: string, note: string, dailyLimit: 1 | 2 | 3): Habit {
  name = name.trim(); note = note.trim()
  if (!isText(name, 80, true)) throw new Error('Введи название до 80 символов.')
  if (!isText(note, 200) || ![1, 2, 3].includes(dailyLimit)) throw new Error('Проверь комментарий и дневной лимит.')
  return { id: id(), name, note, dailyLimit, charges: [] }
}
export const todayCount = (habit: Habit, at = Date.now()) => habit.charges.filter(c => c.day === dayKey(at)).length
export function charge(habit: Habit, at = Date.now()): Charge {
  if (habit.charges.length >= GOAL) throw new Error('ХЭБ уже собран.')
  if (todayCount(habit, at) >= habit.dailyLimit) throw new Error('На сегодня хватит. Новый заряд — завтра.')
  const c = { id: id(), at, day: dayKey(at) }
  habit.charges.push(c)
  return c
}
export function saveEnergy(score: number, note: string): Energy {
  if (!Number.isInteger(score) || score < 0 || score > 10 || !isText(note, 500)) throw new Error('Выбери уровень от 0 до 10 и проверь комментарий.')
  return { id: id(), at: Date.now(), score, note: note.trim() }
}
export function saveMood(score: number, note: string): Energy {
  if (!Number.isInteger(score) || score < 1 || score > 10 || !isText(note, 500)) throw new Error('Выбери настроение и проверь комментарий.')
  return { id: id(), at: Date.now(), score, note: note.trim(), kind: 'mood' }
}
export function createIdea(title: string, text: string): Idea {
  if (!isText(title, 100, true) || !isText(text, 4000, true)) throw new Error('Добавь название и текст идеи.')
  return { id: id(), at: Date.now(), title: title.trim(), text: text.trim() }
}
export const remainingAt = (focus: Focus, now = Date.now()) => focus.deadline === null ? focus.remaining : Math.max(0, focus.deadline - now)
