import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GOAL, STORE_KEY, createHabit, charge, todayCount, newTracker, loadTracker, saveEnergy, saveMood, createIdea, remainingAt, newFocus } from '../src/tracker.ts'

test('ХЭБ blocks only the current local day, can undo, and never passes 21', () => {
  const h = createHabit(' Бокс ', 'После работы', 3)
  assert.equal(h.name, 'Бокс')
  const date = n => +new Date(2026, 10, 1 + n, 12)
  for (let i = 0; i < 3; i++) charge(h, date(0))
  assert.throws(() => charge(h, date(0)), /завтра/)
  h.charges.pop()
  assert.equal(todayCount(h, date(0)), 2)
  charge(h, date(0))
  for (let n = 1; n < 7; n++) for (let i = 0; i < 3; i++) charge(h, date(n * 2))
  assert.equal(h.charges.length, GOAL)
  assert.throws(() => charge(h, date(20)), /собран/)
})

test('timer deadline survives a round trip; invalid storage is rejected', () => {
  const state = newTracker()
  state.focus = { ...newFocus(30), deadline: 100_000 }
  state.ideas.push(createIdea('Фокус', 'Мини-таймер для идеи'))
  state.energy.push(saveEnergy(0, 'Нужен отдых'))
  const store = { getItem: key => key === STORE_KEY ? JSON.stringify(state) : '{old data' }
  const loaded = loadTracker(store)
  assert.equal(remainingAt(loaded.focus, 90_000), 10_000)
  assert.equal(remainingAt(loaded.focus, 101_000), 0)
  assert.deepEqual(loaded.ideas, state.ideas)
  assert.throws(() => loadTracker({ getItem: () => '{bad' }))
  assert.throws(() => saveEnergy(11, ''))
})

test('new mood check-ins can share a diary with the old energy scale', () => {
  const state = newTracker()
  const previous = saveEnergy(1, 'Без сил')
  const angry = saveMood(1, '  Много шума  ')
  const happy = saveMood(10, '')
  state.energy.push(happy, angry, previous)
  assert.deepEqual(loadTracker({ getItem: () => JSON.stringify(state) }).energy, [
    { ...happy, kind: 'mood', score: 10 },
    { ...angry, kind: 'mood', score: 1, note: 'Много шума' },
    { id: previous.id, at: previous.at, score: 1, note: 'Без сил' },
  ])
  assert.throws(() => saveMood(0, ''))
  assert.throws(() => saveMood(11, ''))
  assert.throws(() => saveMood(5, 'я'.repeat(501)))
})
