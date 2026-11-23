<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronRight, Clock3, Grid2X2, Lightbulb, Pause, Play, Plus, RotateCcw, Smile, Trash2, Zap } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bubble, BubbleContent, BubbleGroup } from '@/components/ui/bubble'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import FocusChip from '@/components/FocusChip.vue'
import FocusDial from '@/components/FocusDial.vue'
import MoodPicker from '@/components/MoodPicker.vue'
import VoiceNotes from '@/components/VoiceNotes.vue'
import { CALM_MOOD, energyColor, energyLabel, moodByScore, type MoodScore } from '@/lib/mood'
import { GOAL, MINUTES, STORE_KEY, charge, createHabit, createIdea, loadTracker, dayKey, newFocus, newTracker, remainingAt, saveMood, todayCount } from '@/tracker'
import type { Habit, Minutes, Tracker } from '@/tracker'

const sections = [
  { id:'habits', name:'Хэбы', icon:Grid2X2, eyebrow:'ЕЖЕДНЕВНЫЕ ПРИВЫЧКИ', description:'Один заряд за раз. Всего — двадцать один.' },
  { id:'focus', name:'Фокус', icon:Clock3, eyebrow:'ТАЙМЕР', description:'Выбери длительность и займись одним делом.' },
  { id:'energy', name:'Энергия', icon:Zap, eyebrow:'ДНЕВНИК СОСТОЯНИЯ', description:'Отметь, как ты себя чувствуешь сейчас.' },
  { id:'ideas', name:'Идеи', icon:Lightbulb, eyebrow:'ЛИЧНЫЕ ЗАМЕТКИ', description:'Поймай сейчас. Разберёшь потом.' },
] as const
const section = ref<typeof sections[number]['id']>('habits')
const currentPage = computed(() => sections.find(item => item.id === section.value) ?? sections[0])
const pageHeading = ref<HTMLHeadingElement | null>(null)
const state = ref(newTracker())
const storageError = ref('')
const formError = ref('')
const now = ref(Date.now())
const toastMessage = ref('')
let toastTimer: number | undefined
let ticker: number | undefined
let audio: AudioContext | undefined
let navigationTransition: ViewTransition | undefined
let navigationRevision = 0
const active = computed(() => state.value.habits.filter(h => h.charges.length < GOAL))
const completed = computed(() => state.value.habits.filter(h => h.charges.length === GOAL))
const habitFilter = ref<'active'|'completed'>('active')
const filters = [
  { key:'active', label:'Активные', habits:active, empty:'Все хэбы собраны. Можно начать новый.' },
  { key:'completed', label:'Собранные', habits:completed, empty:'Здесь появятся хэбы с 21 зарядом.' },
] as const
const createOpen = ref(false)
const deleteHabit = ref<Habit | null>(null)
const name = ref(''), note = ref(''), dailyLimit = ref<1|2|3>(1)
const mood = ref<MoodScore>(CALM_MOOD), energyNote = ref(''), energyCommentOpen = ref(false)
const ideaTitle = ref(''), ideaText = ref('')
const today = computed(() => dayKey(now.value))
const todayEntries = computed(() => state.value.energy.filter(entry => dayKey(entry.at) === today.value).length)
const remaining = computed(() => remainingAt(state.value.focus, now.value))
const seconds = computed(() => Math.ceil(remaining.value / 1000))
const running = computed(() => state.value.focus.deadline !== null && remaining.value > 0)
const finished = computed(() => state.value.focus.finished || remaining.value === 0)
const timeText = computed(() => `${String(Math.floor(seconds.value / 60)).padStart(2,'0')}:${String(seconds.value % 60).padStart(2,'0')}`)
const stamp = new Intl.DateTimeFormat('ru', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
const last = (h: Habit) => h.charges.at(-1)

function hydrate() {
  try { state.value = loadTracker(localStorage); storageError.value = '' }
  catch { storageError.value = 'Не удалось открыть данные в этом браузере. Сохранённые записи не перезаписаны.' }
}
function save(change: (data: Tracker) => void) {
  formError.value = ''
  try {
    const next = loadTracker(localStorage)
    change(next)
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
    state.value = next
    storageError.value = ''
    now.value = Date.now()
    return true
  } catch (e) {
    formError.value = e instanceof Error && e.name === 'Error' ? e.message : 'Не удалось сохранить изменение в этом браузере.'
    return false
  }
}
function inform(message: string) {
  toastMessage.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastMessage.value = '' }, 4500)
}
function go(next: typeof section.value, focusTitle = false) {
  formError.value = ''
  const revision = ++navigationRevision
  const interrupted = navigationTransition
  interrupted?.skipTransition()
  const update = async () => {
    if (revision !== navigationRevision) return
    const changed = next !== section.value
    section.value = next
    await nextTick()
    if (revision !== navigationRevision) return
    if (changed) window.scrollTo({ top:0, behavior:'instant' })
    if (focusTitle) pageHeading.value?.focus({ preventScroll:true })
  }

  // Switch both views in one capture while keeping the existing timer state.
  if (!interrupted && next !== section.value && (next === 'focus' || section.value === 'focus')
    && running.value && remaining.value > 1000 && typeof document.startViewTransition === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const transition = document.startViewTransition(update)
    navigationTransition = transition
    void transition.finished.finally(() => {
      if (navigationTransition === transition) navigationTransition = undefined
    }).catch(() => {})
  } else void update()
}
function openCreate() { name.value = ''; note.value = ''; dailyLimit.value = 1; formError.value = ''; createOpen.value = true }
function addHabit() {
  if (!save(d => d.habits.unshift(createHabit(name.value, note.value, dailyLimit.value)))) return
  createOpen.value = false; go('habits'); habitFilter.value = 'active'; inform('ХЭБ создан. Первый заряд — за тобой!')
}
function changeCharge(h: Habit, undo = false) {
  if (!save(d => {
    const current = d.habits.find(x => x.id === h.id)
    if (!current) throw new Error('Этой привычки уже нет.')
    if (undo) current.charges.pop(); else charge(current)
  })) return
  if (undo) { habitFilter.value = 'active'; inform('Последняя отметка отменена.') }
  else inform(state.value.habits.find(x => x.id === h.id)?.charges.length === GOAL ? '21 из 21. ХЭБ собран!' : 'Дело сделано! +1 заряд.')
}
function removeHabit() {
  if (!deleteHabit.value) return
  if (save(d => { d.habits = d.habits.filter(h => h.id !== deleteHabit.value?.id) })) { deleteHabit.value = null; inform('ХЭБ удалён.') }
}
function chooseMinutes(minutes: Minutes) { if (!running.value) save(d => { d.focus = newFocus(minutes) }) }
function toggleTimer() {
  try { audio ??= new AudioContext(); if (audio.state === 'suspended') void audio.resume().catch(() => {}) } catch {}
  save(d => {
    const at = Date.now(), left = remainingAt(d.focus, at)
    if (d.focus.deadline !== null && left > 0) d.focus = { ...d.focus, remaining:left, deadline:null }
    else { if (!left) d.focus = newFocus(d.focus.minutes); d.focus.deadline = at + d.focus.remaining }
  })
}
function chime() {
  if (!audio || audio.state !== 'running') return
  const start = audio.currentTime
  for (const [index, hz] of [523, 659].entries()) {
    const time = start + index * .16, oscillator = audio.createOscillator(), gain = audio.createGain()
    oscillator.type = 'sine'; oscillator.frequency.value = hz; gain.gain.setValueAtTime(.001,time); gain.gain.exponentialRampToValueAtTime(.09,time+.04); gain.gain.exponentialRampToValueAtTime(.001,time+.42)
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(time); oscillator.stop(time+.43)
  }
}
function tick() {
  now.value = Date.now()
  const deadline = state.value.focus.deadline
  if (deadline !== null && deadline <= now.value) {
    let ended = false
    if (save(d => { if (d.focus.deadline === deadline) { d.focus = { ...d.focus, remaining:0, deadline:null, finished:true }; ended = true } }) && ended) { chime(); inform('Фокус завершён. Можно выдохнуть.') }
  }
}
async function openEnergyComment() {
  energyCommentOpen.value = true
  await nextTick()
  document.getElementById('energy-note')?.focus()
}
function addMood() {
  if (save(d => { d.energy.unshift(saveMood(mood.value, energyNote.value)) })) {
    energyNote.value = ''
    energyCommentOpen.value = false
    inform('Настроение записано.')
  }
}
function addIdea() { if (save(d => { d.ideas.unshift(createIdea(ideaTitle.value, ideaText.value)) })) { ideaTitle.value = ''; ideaText.value = ''; inform('Идея на месте.') } }
function storageChanged(event: StorageEvent) { if (event.key === STORE_KEY || event.key === null) hydrate() }
onMounted(() => { hydrate(); tick(); ticker = window.setInterval(tick, 250); window.addEventListener('storage', storageChanged) })
onBeforeUnmount(() => { ++navigationRevision; navigationTransition?.skipTransition(); window.clearInterval(ticker); window.clearTimeout(toastTimer); window.removeEventListener('storage', storageChanged); if (audio) void audio.close().catch(() => {}) })
</script>

<template>
  <div class="app-shell">
    <aside class="rail">
      <Button type="button" variant="ghost" class="brand" aria-label=":21 — к хэбам" @click="go('habits')">
        <span class="brand-mark"><Zap :size="15" fill="currentColor" aria-hidden="true" /></span>
        <strong>:21</strong><span class="brand-label">Трекер привычек</span>
      </Button>
      <div class="rail-section">Разделы</div>
      <nav class="nav-list" aria-label="Разделы">
        <Button v-for="item in sections" :key="item.id" type="button" :variant="section === item.id ? 'secondary' : 'ghost'"
          class="nav-link" :aria-current="section === item.id ? 'page' : undefined" @click="go(item.id)">
          <component :is="item.icon" class="size-[18px]" aria-hidden="true" />
          <span>{{ item.name }}</span>
        </Button>
      </nav>
      <div class="rail-foot"><span aria-hidden="true" />Данные на устройстве</div>
    </aside>

    <div class="workspace" :class="{ 'workspace--energy': section === 'energy' }">
      <header class="workspace-bar">
        <div class="workspace-bar-inner">
          <Button type="button" variant="ghost" class="brand mobile-brand" aria-label=":21 — к хэбам" @click="go('habits')">
            <span class="brand-mark"><Zap :size="15" fill="currentColor" aria-hidden="true" /></span><strong>:21</strong>
          </Button>
          <div class="breadcrumb">
            <span>Личное пространство</span><ChevronRight :size="14" aria-hidden="true" /><span>{{ currentPage.name }}</span>
          </div>
          <div class="workspace-actions">
            <FocusChip v-if="section !== 'focus' && running" :remaining="seconds" :total="state.focus.minutes * 60" :text="timeText" @click="go('focus', true)" />
            <span v-if="section === 'energy'" class="energy-mobile-label">Энергия</span>
            <Button v-else type="button" class="new-habit" aria-label="Новый хэб" @click="openCreate">
              <Plus data-icon="inline-start" aria-hidden="true" /><span>Новый хэб</span>
            </Button>
          </div>
        </div>
      </header>

      <main class="main-content" :class="{ 'main-content--energy': section === 'energy' }">
        <header v-if="section !== 'energy'" class="page-header">
          <div>
            <p class="eyebrow">{{ currentPage.eyebrow }}</p>
            <h1 id="page-heading" ref="pageHeading" tabindex="-1">{{ currentPage.name }}</h1>
            <p class="page-description">{{ currentPage.description }}</p>
          </div>
          <Badge v-if="section === 'habits'" variant="outline" class="date-badge hidden md:inline-flex">Цель · {{ GOAL }} заряд</Badge>
        </header>

        <p v-if="storageError" class="error" role="alert">{{ storageError }}</p>
        <p v-if="formError && !createOpen && !deleteHabit && section !== 'energy'" class="error" role="alert">{{ formError }}</p>

        <section v-if="section === 'habits'" aria-labelledby="page-heading">
          <div class="content-grid">
            <Card class="panel">
              <CardHeader>
                <CardTitle class="panel-title">Твои хэбы</CardTitle>
                <CardDescription>Здесь виден прогресс каждой привычки.</CardDescription>
              </CardHeader>
              <CardContent>
                <Empty v-if="!state.habits.length" class="empty-state">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Zap aria-hidden="true" /></EmptyMedia>
                    <EmptyTitle>Пока ни одного заряда</EmptyTitle>
                    <EmptyDescription>Выбери привычку, которую хочется повторять.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent><Button type="button" @click="openCreate"><Plus data-icon="inline-start" aria-hidden="true" />Создать первый хэб</Button></EmptyContent>
                </Empty>
                <Tabs v-else v-model="habitFilter" class="gap-4">
                  <TabsList aria-label="Хэбы по состоянию" class="habit-tabs">
                    <TabsTrigger v-for="filter in filters" :key="filter.key" :value="filter.key">
                      {{ filter.label }} <span class="tab-count">{{ filter.habits.value.length }}</span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent v-for="filter in filters" :key="filter.key" :value="filter.key">
                    <Empty v-if="!filter.habits.value.length" class="empty-state">
                      <EmptyHeader><EmptyMedia variant="icon"><Grid2X2 aria-hidden="true" /></EmptyMedia><EmptyTitle>{{ filter.empty }}</EmptyTitle></EmptyHeader>
                    </Empty>
                    <ItemGroup v-else as="ul" class="gap-3">
                      <Item v-for="h in filter.habits.value" :key="h.id" as="li" variant="outline" class="habit-item">
                        <ItemContent>
                          <ItemTitle class="habit-title">{{ h.name }}</ItemTitle>
                          <ItemDescription v-if="h.note" class="line-clamp-none whitespace-pre-wrap wrap-anywhere">{{ h.note }}</ItemDescription>
                        </ItemContent>
                        <ItemActions><Badge variant="secondary" class="counter-badge">{{ h.charges.length }} / {{ GOAL }}</Badge></ItemActions>
                        <div class="habit-progress">
                          <Progress class="h-1.5" :model-value="h.charges.length / GOAL * 100" :aria-label="`Прогресс: ${h.name}`" :aria-valuetext="`${h.charges.length} из ${GOAL}`" />
                          <div class="habit-meta"><span>{{ h.charges.length === GOAL ? 'Хэб собран' : `Сегодня: ${todayCount(h, now)} / ${h.dailyLimit}` }}</span><time v-if="last(h)" :datetime="new Date(last(h)!.at).toISOString()">{{ stamp.format(last(h)!.at) }}</time></div>
                        </div>
                        <ItemActions class="habit-controls">
                          <Button v-if="h.charges.length < GOAL" type="button" :disabled="todayCount(h, now) >= h.dailyLimit" @click="changeCharge(h)">
                            <Zap data-icon="inline-start" aria-hidden="true" />{{ todayCount(h, now) >= h.dailyLimit ? 'До завтра' : '+1 заряд' }}
                          </Button>
                          <Button v-if="h.charges.length" type="button" variant="ghost" class="text-muted-foreground" @click="changeCharge(h,true)">
                            <RotateCcw data-icon="inline-start" aria-hidden="true" />Отменить заряд
                          </Button>
                          <Button type="button" variant="ghost" size="icon" class="delete-habit text-muted-foreground" :aria-label="`Удалить хэб ${h.name}`" @click="formError = ''; deleteHabit = h"><Trash2 aria-hidden="true" /></Button>
                        </ItemActions>
                      </Item>
                    </ItemGroup>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            <Card class="panel side-panel">
              <CardHeader><CardTitle class="panel-title">Твой прогресс</CardTitle><CardDescription>Каждое повторение — один заряд.</CardDescription></CardHeader>
              <CardContent>
                <div class="habit-totals">
                  <div><strong>{{ active.length }}</strong><span>Активные</span></div>
                  <div><strong>{{ completed.length }}</strong><span>Собранные</span></div>
                </div>
                <Bubble variant="tinted" class="tip-bubble"><BubbleContent>Пропустил день? Все заряды на месте. Продолжай в своём темпе.</BubbleContent></Bubble>
              </CardContent>
            </Card>
          </div>
        </section>

        <section v-else-if="section === 'focus'" aria-labelledby="page-heading">
          <Card class="focus-panel panel">
            <CardHeader class="focus-panel-head">
              <CardTitle class="sr-only">Таймер на {{ state.focus.minutes }} минут</CardTitle>
              <ButtonGroup v-if="!running" aria-label="Длительность таймера">
                <Button v-for="m in MINUTES" :key="m" type="button" :variant="m === state.focus.minutes ? 'secondary' : 'outline'" :aria-pressed="m === state.focus.minutes" @click="chooseMinutes(m)">{{ m }} мин</Button>
              </ButtonGroup>
              <Badge v-else variant="outline" class="focus-status"><span />Сессия идёт</Badge>
            </CardHeader>
            <CardContent class="focus-stage">
              <FocusDial :remaining="seconds" :total="state.focus.minutes * 60" :text="timeText" :state="finished ? 'ГОТОВО' : running ? 'В ФОКУСЕ' : remaining < state.focus.minutes * 60_000 ? 'НА ПАУЗЕ' : 'ФОКУС'" :caption="`из ${state.focus.minutes}:00`" />
              <div class="focus-actions">
                <Button type="button" size="lg" class="focus-primary" @click="toggleTimer">
                  <Pause v-if="running" fill="currentColor" aria-hidden="true" /><Play v-else fill="currentColor" aria-hidden="true" />
                  {{ running ? 'Пауза' : finished ? 'Начать заново' : remaining < state.focus.minutes * 60_000 ? 'Продолжить' : 'Начать' }}
                </Button>
                <Button v-if="!running && remaining < state.focus.minutes * 60_000" type="button" variant="ghost" class="text-muted-foreground" @click="chooseMinutes(state.focus.minutes)">Сбросить</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section v-else-if="section === 'energy'" class="energy-layout" aria-labelledby="page-heading">
            <form class="energy-checkin" @submit.prevent="addMood">
              <h1 id="page-heading" ref="pageHeading" class="energy-question" tabindex="-1">Как ты сейчас?</h1>
              <MoodPicker v-model="mood" />
              <div class="energy-actions">
                <Button v-if="!energyCommentOpen" type="button" variant="ghost" class="energy-comment-toggle" @click="openEnergyComment">
                  <Plus data-icon="inline-start" aria-hidden="true" />Добавить комментарий
                </Button>
                <Field v-else class="energy-comment gap-2">
                  <div class="field-top"><FieldLabel for="energy-note">Комментарий</FieldLabel><span>Необязательно</span></div>
                  <Textarea id="energy-note" v-model="energyNote" maxlength="500" class="journal-textarea" aria-describedby="energy-count" placeholder="Что повлияло на настроение?" />
                  <FieldDescription id="energy-count" class="text-right text-xs">{{ energyNote.length }} / 500</FieldDescription>
                </Field>
                <p v-if="formError" class="error" role="alert">{{ formError }}</p>
                <Button type="submit" size="lg" class="energy-submit">Записать настроение</Button>
              </div>
            </form>
            <Card class="panel side-panel energy-history">
              <CardHeader>
                <div class="panel-heading-row"><CardTitle class="panel-title">История</CardTitle><Badge variant="outline" class="counter-badge">Сегодня · {{ todayEntries }}</Badge></div>
                <CardDescription>Твои отметки и комментарии.</CardDescription>
              </CardHeader>
              <CardContent>
                <Empty v-if="!state.energy.length" class="empty-state">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Smile aria-hidden="true" /></EmptyMedia>
                    <EmptyTitle>Пока без отметок</EmptyTitle><EmptyDescription>Первая запись появится здесь.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
                <BubbleGroup v-else as="ul" class="diary-list">
                  <Bubble v-for="entry in state.energy" :key="entry.id" as="li" variant="muted" class="diary-bubble">
                    <BubbleContent class="diary-bubble-content">
                      <div class="entry-head">
                        <span v-if="entry.kind === 'mood'" class="entry-score" :style="{ '--entry-mood': moodByScore(entry.score).color }"><span aria-hidden="true" />{{ moodByScore(entry.score).label }}</span>
                        <span v-else class="entry-score" :style="{ '--entry-mood': energyColor(entry.score) }"><span aria-hidden="true" />{{ entry.score }}/10 · {{ energyLabel(entry.score) }}</span>
                        <time :datetime="new Date(entry.at).toISOString()">{{ stamp.format(entry.at) }}</time>
                      </div>
                      <p v-if="entry.note" class="entry-text">{{ entry.note }}</p>
                    </BubbleContent>
                  </Bubble>
                </BubbleGroup>
              </CardContent>
            </Card>
        </section>

        <section v-show="section === 'ideas'" aria-labelledby="page-heading">
          <div class="content-grid">
            <div class="ideas-compose">
              <VoiceNotes :active="section === 'ideas'" />
              <Card class="panel">
                <CardHeader>
                  <CardTitle class="panel-title">Новая идея</CardTitle>
                  <CardDescription>Пары строк достаточно, чтобы не забыть замысел.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form class="form-stack" @submit.prevent="addIdea">
                    <FieldGroup class="gap-4">
                      <Field class="gap-2"><FieldLabel for="idea-title">Название</FieldLabel><Input id="idea-title" v-model="ideaTitle" required maxlength="100" placeholder="О чём идея?" /></Field>
                      <Field class="gap-2"><FieldLabel for="idea-text">Текст</FieldLabel><Textarea id="idea-text" v-model="ideaText" required maxlength="4000" aria-describedby="idea-count" class="journal-textarea" placeholder="Запиши, пока не улетела" /></Field>
                    </FieldGroup>
                    <div class="form-foot"><span id="idea-count">{{ ideaText.length }} / 4000</span><Button type="submit" size="lg">Сохранить идею</Button></div>
                  </form>
                </CardContent>
              </Card>
            </div>
            <Card class="panel side-panel">
              <CardHeader>
                <div class="panel-heading-row"><CardTitle class="panel-title">Сохранённые идеи</CardTitle><Badge variant="outline" class="counter-badge">{{ state.ideas.length }}</Badge></div>
                <CardDescription>Загляни сюда, когда вернёшься к задумкам.</CardDescription>
              </CardHeader>
              <CardContent>
                <Empty v-if="!state.ideas.length" class="empty-state">
                  <EmptyHeader><EmptyMedia variant="icon"><Lightbulb aria-hidden="true" /></EmptyMedia><EmptyTitle>Здесь появятся идеи</EmptyTitle><EmptyDescription>Запиши первую, как только придёт в голову.</EmptyDescription></EmptyHeader>
                </Empty>
                <BubbleGroup v-else as="ul" class="diary-list">
                  <Bubble v-for="idea in state.ideas" :key="idea.id" as="li" variant="muted" class="diary-bubble">
                    <BubbleContent class="diary-bubble-content">
                      <div class="entry-head"><strong class="idea-title">{{ idea.title }}</strong><time :datetime="new Date(idea.at).toISOString()">{{ stamp.format(idea.at) }}</time></div>
                      <p class="entry-text">{{ idea.text }}</p>
                    </BubbleContent>
                  </Bubble>
                </BubbleGroup>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>

    <Dialog v-model:open="createOpen">
      <DialogContent class="max-h-[90svh] overflow-y-auto" :show-close-button="false">
        <DialogHeader><DialogTitle>Новый хэб</DialogTitle><DialogDescription>Цель — 21 выполнение. Дневной лимит выбираешь ты.</DialogDescription></DialogHeader>
        <form class="form-stack" @submit.prevent="addHabit">
          <FieldGroup class="gap-4">
            <Field class="gap-2"><FieldLabel for="habit-name">Привычка</FieldLabel><Input id="habit-name" v-model="name" maxlength="80" required placeholder="Например, ходить на бокс" /></Field>
            <Field class="gap-2">
              <div class="field-top"><FieldLabel for="habit-note">Комментарий</FieldLabel><span>Необязательно</span></div>
              <Textarea id="habit-note" v-model="note" maxlength="200" aria-describedby="habit-count" placeholder="Когда или зачем?" />
              <FieldDescription id="habit-count" class="text-right text-xs">{{ note.length }} / 200</FieldDescription>
            </Field>
            <FieldSet class="gap-2">
              <FieldLegend variant="label">Максимум выполнений в день</FieldLegend>
              <ButtonGroup><Button v-for="n in ([1,2,3] as const)" :key="n" type="button" :variant="dailyLimit === n ? 'secondary' : 'outline'" :aria-pressed="dailyLimit === n" @click="dailyLimit = n">{{ n }}</Button></ButtonGroup>
            </FieldSet>
          </FieldGroup>
          <p v-if="formError" class="error" role="alert">{{ formError }}</p>
          <DialogFooter><Button variant="outline" type="button" @click="createOpen = false; formError = ''">Отмена</Button><Button type="submit">Создать хэб</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog :open="!!deleteHabit" @update:open="open => { if (!open) { deleteHabit = null; formError = '' } }">
      <DialogContent :show-close-button="false">
        <DialogHeader><DialogTitle>Удалить хэб?</DialogTitle><DialogDescription>«{{ deleteHabit?.name }}» и его отметки будут удалены с этого устройства.</DialogDescription></DialogHeader>
        <p v-if="formError" class="error" role="alert">{{ formError }}</p>
        <DialogFooter><Button variant="outline" type="button" @click="deleteHabit = null; formError = ''">Отмена</Button><Button variant="destructive" type="button" @click="removeHabit">Удалить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <div class="notice" role="status">
      <Bubble v-if="toastMessage" variant="outline" class="notice-bubble"><BubbleContent><Check :size="16" aria-hidden="true" />{{ toastMessage }}</BubbleContent></Bubble>
    </div>
  </div>
</template>
