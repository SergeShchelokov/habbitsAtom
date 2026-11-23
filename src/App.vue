<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Activity, Check, Pause, Play, Plus, Trash2, Zap } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import ChargeRing from '@/components/ChargeRing.vue'
import FocusChip from '@/components/FocusChip.vue'
import FocusDial from '@/components/FocusDial.vue'
import { GOAL, MINUTES, STORE_KEY, charge, createHabit, createIdea, loadTracker, newFocus, newTracker, remainingAt, saveEnergy, todayCount } from '@/tracker'
import type { Habit, Minutes, Tracker } from '@/tracker'

const figma = import.meta.env.BASE_URL + 'assets/figma/'
const sections = [{id:'habits',name:'Хэбы',asset:'grid.svg'},{id:'focus',name:'Фокус',asset:'focus.svg'},{id:'energy',name:'Энергия',asset:''},{id:'ideas',name:'Идеи',asset:'ideas.svg'}] as const
const section = ref<typeof sections[number]['id']>('habits')
const focusHeading = ref<HTMLHeadingElement | null>(null)
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
const habitList = computed(() => habitFilter.value === 'active' ? active.value : completed.value)
const createOpen = ref(false)
const deleteHabit = ref<Habit | null>(null)
const name = ref(''), note = ref(''), dailyLimit = ref<1|2|3>(1)
const energy = ref([5]), energyNote = ref('')
const ideaTitle = ref(''), ideaText = ref('')
const energyValue = computed(() => energy.value[0] ?? 5)
const energyMood = computed(() => energyValue.value <= 2 ? 'Батарейка на нуле' : energyValue.value <= 4 ? 'На спаде' : energyValue.value <= 6 ? 'Ровно' : energyValue.value <= 8 ? 'Хороший заряд' : 'Полон энергии')
const remaining = computed(() => remainingAt(state.value.focus, now.value))
const seconds = computed(() => Math.ceil(remaining.value / 1000))
const running = computed(() => state.value.focus.deadline !== null && remaining.value > 0)
const finished = computed(() => state.value.focus.finished || remaining.value === 0)
const timeText = computed(() => `${String(Math.floor(seconds.value / 60)).padStart(2,'0')}:${String(seconds.value % 60).padStart(2,'0')}`)
const stamp = new Intl.DateTimeFormat('ru', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
const last = (h: Habit) => h.charges.at(-1)
const coin = import.meta.env.BASE_URL + 'assets/empty-coin.png'

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
    section.value = next
    await nextTick()
    if (focusTitle && revision === navigationRevision) focusHeading.value?.focus()
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
function addEnergy() { if (save(d => { d.energy.unshift(saveEnergy(energyValue.value, energyNote.value)) })) { energyNote.value = ''; inform('Уровень энергии записан.') } }
function addIdea() { if (save(d => { d.ideas.unshift(createIdea(ideaTitle.value, ideaText.value)) })) { ideaTitle.value = ''; ideaText.value = ''; inform('Идея на месте.') } }
function storageChanged(event: StorageEvent) { if (event.key === STORE_KEY || event.key === null) hydrate() }
onMounted(() => { hydrate(); tick(); ticker = window.setInterval(tick, 250); window.addEventListener('storage', storageChanged) })
onBeforeUnmount(() => { ++navigationRevision; navigationTransition?.skipTransition(); window.clearInterval(ticker); window.clearTimeout(toastTimer); window.removeEventListener('storage', storageChanged); if (audio) void audio.close().catch(() => {}) })
</script>

<template>
  <div class="app-shell">
    <aside class="rail" aria-label="Навигация">
      <Button class="brand" variant="ghost" aria-label=":21 — к хэбам" @click="go('habits')"><img :src="figma + 'logo.svg'" alt=":21" /></Button>
      <div class="rail-create"><img class="add-glow" :src="figma + 'add-glow.svg'" alt=""/><Button class="rail-add" aria-label="Новый хэб" @click="openCreate"><img :src="figma + 'add.svg'" alt=""/></Button></div>
      <nav class="nav-list" aria-label="Разделы">
        <Button v-for="item in sections" :key="item.id" :variant="section === item.id ? 'secondary' : 'ghost'" :class="['nav-link', {'is-current':section === item.id}]" :aria-current="section === item.id ? 'page' : undefined" @click="go(item.id)"><span class="nav-icon"><img v-if="item.asset" :src="figma + item.asset" alt=""/><Activity v-else :size="29" aria-hidden="true"/></span>{{ item.name }}</Button>
      </nav>
    </aside>
    <main :class="['main-content', { 'is-focus': section === 'focus' }]">
      <header v-if="section !== 'focus'" class="top-line">
        <span>ЛИЧНОЕ ПРОСТРАНСТВО</span>
        <FocusChip v-if="running" :remaining="seconds" :total="state.focus.minutes * 60" :text="timeText" @click="go('focus', true)" />
        <Badge v-else variant="outline" class="rounded-full text-muted-foreground">На этом устройстве</Badge>
      </header>
      <p v-if="storageError" class="error" role="alert">{{ storageError }}</p>
      <p v-if="formError && !createOpen && !deleteHabit" class="error" role="alert">{{ formError }}</p>

      <section v-if="section === 'habits'" aria-labelledby="habits-heading">
        <header class="page-header"><div><h1 id="habits-heading">Твои хэбы</h1><p>Один заряд за раз. Всего — двадцать один.</p></div><Button v-if="state.habits.length" class="page-add rounded-full min-h-11 px-5" @click="openCreate"><Plus aria-hidden="true"/>Новый хэб</Button></header>
        <Card v-if="!state.habits.length" class="empty-card">
          <CardContent class="flex flex-col items-center gap-4 py-12 text-center sm:py-17">
            <img :src="coin" width="142" height="142" alt="" class="size-32 object-contain sm:size-36"/>
            <CardTitle class="text-2xl">Пока ни одного заряда</CardTitle>
            <p class="max-w-sm text-sm leading-relaxed text-muted-foreground">Выбери привычку, которую хочется повторить. Первый заряд — уже хороший старт.</p>
            <Button class="mt-2 rounded-full min-h-11 px-5" @click="openCreate"><Plus aria-hidden="true"/>Создать первый хэб</Button>
          </CardContent>
        </Card>
        <template v-else>
          <div class="segmented" aria-label="Показать хэбы">
            <Button v-for="filter in (['active','completed'] as const)" :key="filter" :variant="habitFilter === filter ? 'secondary' : 'ghost'" :aria-pressed="habitFilter === filter" @click="habitFilter = filter">{{ filter === 'active' ? `Активные · ${active.length}` : `Собранные · ${completed.length}` }}</Button>
          </div>
          <Card v-if="!habitList.length"><CardContent class="py-8 text-muted-foreground">{{ habitFilter === 'active' ? 'Все хэбы собраны. Можно начать новый.' : 'Здесь появятся хэбы с 21 зарядом.' }}</CardContent></Card>
          <div v-else class="habit-list">
            <Card v-for="h in habitList" :key="h.id" class="habit-card gap-0 py-0">
              <CardContent class="habit-inner">
                <ChargeRing class="habit-ring" :value="h.charges.length" :max="GOAL" :label="`Прогресс: ${h.name}`" :text="String(h.charges.length)" caption="из 21"/>
                <div class="min-w-0"><Badge variant="outline" class="mb-2 text-muted-foreground">{{ h.charges.length === GOAL ? 'ХЭБ СОБРАН' : `СЕГОДНЯ ${todayCount(h, now)} ИЗ ${h.dailyLimit}` }}</Badge><CardTitle class="habit-title break-words">{{ h.name }}</CardTitle><p v-if="h.note" class="habit-note">{{ h.note }}</p><p v-if="last(h)" class="habit-note">Последний заряд: {{ stamp.format(last(h)!.at) }}</p></div>
                <div class="habit-actions"><Button class="rounded-full" :disabled="h.charges.length === GOAL || todayCount(h, now) >= h.dailyLimit" @click="changeCharge(h)"><Zap aria-hidden="true"/>{{ h.charges.length === GOAL ? 'Собран' : todayCount(h, now) >= h.dailyLimit ? 'До завтра' : '+1 заряд' }}</Button><Button v-if="h.charges.length" variant="ghost" class="text-muted-foreground" @click="changeCharge(h,true)">Отменить заряд</Button><Button variant="ghost" size="icon" class="text-muted-foreground" :aria-label="`Удалить хэб ${h.name}`" @click="formError = ''; deleteHabit = h"><Trash2 aria-hidden="true"/></Button></div>
              </CardContent>
            </Card>
          </div>
        </template>
      </section>

      <section v-else-if="section === 'focus'" aria-labelledby="focus-heading">
        <nav class="focus-breadcrumb" aria-label="Путь"><button type="button" @click="go('habits')">Хэбы</button><span aria-hidden="true">/</span><span aria-current="page">Фокус</span></nav>
        <header class="page-header focus-heading"><div><h1 id="focus-heading" ref="focusHeading" tabindex="-1">Фокус на {{ state.focus.minutes }} минут</h1></div></header>
        <div class="focus-stage">
          <div v-if="!running" class="segmented focus-presets" aria-label="Длительность"><Button v-for="m in MINUTES" :key="m" :variant="m === state.focus.minutes ? 'secondary' : 'ghost'" :aria-pressed="m === state.focus.minutes" @click="chooseMinutes(m)">{{ m }} мин</Button></div>
          <FocusDial :remaining="seconds" :total="state.focus.minutes * 60" :text="timeText" :state="finished ? 'ГОТОВО' : running ? 'В ФОКУСЕ' : remaining < state.focus.minutes * 60_000 ? 'НА ПАУЗЕ' : 'ФОКУС'" :caption="`из ${state.focus.minutes}:00`"/>
          <div class="focus-actions"><Button class="focus-primary" @click="toggleTimer"><Pause v-if="running" fill="currentColor" aria-hidden="true"/><Play v-else fill="currentColor" aria-hidden="true"/>{{ running ? 'Пауза' : finished ? 'Начать заново' : remaining < state.focus.minutes * 60_000 ? 'Продолжить' : 'Начать' }}</Button><Button v-if="!running && remaining < state.focus.minutes * 60_000" variant="ghost" class="text-muted-foreground" @click="chooseMinutes(state.focus.minutes)">Сбросить</Button></div>
        </div>
      </section>

      <section v-else-if="section === 'energy'" aria-labelledby="energy-heading">
        <header class="page-header"><div><h1 id="energy-heading">Энергия</h1><p>Отметь, как ты себя чувствуешь сейчас.</p></div></header>
        <Card><CardHeader><CardTitle>Твой заряд</CardTitle></CardHeader><CardContent>
          <form class="form-stack" @submit.prevent="addEnergy"><div><div class="score-line"><strong>{{ energyValue }}<small> / 10</small></strong><span>{{ energyMood }}</span></div><Slider v-model="energy" :min="0" :max="10" :step="1" aria-label="Уровень энергии от 0 до 10"/><div class="range-labels"><span>Без сил</span><span>Полон энергии</span></div></div><label for="energy-note">Комментарий · необязательно</label><Textarea id="energy-note" v-model="energyNote" maxlength="500" placeholder="Что повлияло на заряд?"/><div class="form-foot"><span>{{ energyNote.length }}/500</span><Button type="submit" class="rounded-full">Записать</Button></div></form>
        </CardContent></Card>
        <div v-if="state.energy.length" class="entry-list"><h2>Записи</h2><Card v-for="e in state.energy" :key="e.id" class="py-4"><CardContent><div class="entry-head"><Badge variant="secondary">{{ e.score }}/10</Badge><time class="text-muted-foreground">{{ stamp.format(e.at) }}</time></div><p v-if="e.note" class="entry-text">{{ e.note }}</p></CardContent></Card></div>
      </section>

      <section v-else aria-labelledby="ideas-heading">
        <header class="page-header"><div><h1 id="ideas-heading">Идеи</h1><p>Поймай сейчас. Разберёшь потом.</p></div></header>
        <Card><CardHeader><CardTitle>Новая идея</CardTitle></CardHeader><CardContent><form class="form-stack" @submit.prevent="addIdea"><label for="idea-title">Название</label><Input id="idea-title" v-model="ideaTitle" required maxlength="100" placeholder="О чём идея?"/><label for="idea-text">Текст</label><Textarea id="idea-text" v-model="ideaText" required maxlength="4000" class="min-h-28" placeholder="Запиши, пока не улетела"/><div class="form-foot"><span>{{ ideaText.length }}/4000</span><Button class="rounded-full" type="submit">Сохранить идею</Button></div></form></CardContent></Card>
        <div v-if="state.ideas.length" class="entry-list"><h2>Сохранённые идеи</h2><Card v-for="i in state.ideas" :key="i.id" class="gap-3"><CardHeader><div class="entry-head"><CardTitle class="break-words">{{ i.title }}</CardTitle><time class="shrink-0 text-xs text-muted-foreground">{{ stamp.format(i.at) }}</time></div></CardHeader><CardContent><p class="entry-text">{{ i.text }}</p></CardContent></Card></div>
      </section>
    </main>

    <Dialog v-model:open="createOpen">
      <DialogContent class="max-h-[90svh] overflow-y-auto" :show-close-button="false"><DialogHeader><DialogTitle>Новый хэб</DialogTitle><DialogDescription>Цель — 21 выполнение. Дневной лимит выбираешь ты.</DialogDescription></DialogHeader>
        <form class="form-stack" @submit.prevent="addHabit"><label for="habit-name">Привычка</label><Input id="habit-name" v-model="name" maxlength="80" required placeholder="Например, ходить на бокс"/><label for="habit-note">Комментарий · необязательно</label><Textarea id="habit-note" v-model="note" maxlength="200" placeholder="Когда или зачем?"/><span class="text-xs text-muted-foreground">{{ note.length }}/200</span><fieldset><legend>Максимум выполнений в день</legend><div class="segmented mt-2"><Button v-for="n in ([1,2,3] as const)" :key="n" type="button" :variant="dailyLimit === n ? 'secondary' : 'ghost'" :aria-pressed="dailyLimit === n" @click="dailyLimit = n">{{ n }}</Button></div></fieldset><p v-if="formError" class="error" role="alert">{{ formError }}</p><DialogFooter><Button variant="outline" type="button" @click="createOpen = false; formError = ''">Отмена</Button><Button type="submit">Создать хэб</Button></DialogFooter></form>
      </DialogContent>
    </Dialog>
    <Dialog :open="!!deleteHabit" @update:open="open => { if (!open) { deleteHabit = null; formError = '' } }"><DialogContent :show-close-button="false"><DialogHeader><DialogTitle>Удалить хэб?</DialogTitle><DialogDescription>«{{ deleteHabit?.name }}» и его отметки будут удалены с этого устройства.</DialogDescription></DialogHeader><p v-if="formError" class="error" role="alert">{{ formError }}</p><DialogFooter><Button variant="outline" @click="deleteHabit = null; formError = ''">Отмена</Button><Button variant="destructive" @click="removeHabit">Удалить</Button></DialogFooter></DialogContent></Dialog>
    <div v-if="toastMessage" class="notice" role="status"><span class="notice-icon"><Check :size="17" aria-hidden="true"/></span>{{ toastMessage }}</div>
  </div>
</template>
