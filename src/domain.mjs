// Keep the original key so existing users retain their data during migration.
export const STORAGE_KEY = "habbits-atom:v1";
export class HabitError extends Error {}
export const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const createDocument = (uuid = () => crypto.randomUUID()) => ({
  schemaVersion: 2,
  revision: 0,
  workspaceId: uuid(),
  deviceId: uuid(),
  habits: [],
  outbox: [],
});
const validDay = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value));
export function readDocument(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw new HabitError(
      "Локальные данные не удалось прочитать. Мы сохранили исходную копию и ничего не перезаписываем.",
    );
  }
  const ids = new Set();
  if (
    !doc ||
    ![1, 2].includes(doc.schemaVersion) ||
    !Number.isInteger(doc.revision) ||
    doc.revision < 0 ||
    typeof doc.workspaceId !== "string" ||
    typeof doc.deviceId !== "string" ||
    !Array.isArray(doc.habits) ||
    !Array.isArray(doc.outbox)
  )
    throw new HabitError(
      "Формат локальных данных не поддерживается. Исходная копия сохранена.",
    );
  for (const habit of doc.habits) {
    if (
      !habit ||
      typeof habit.id !== "string" ||
      ids.has(habit.id) ||
      typeof habit.name !== "string" ||
      !habit.name.trim() ||
      habit.name.length > 80 ||
      !Number.isInteger(habit.target) ||
      habit.target < 1 ||
      habit.target > 365 ||
      !Array.isArray(habit.completions) ||
      habit.completions.length > habit.target ||
      habit.completions.some(
        (item) => !item || !validDay(item.day) || typeof item.id !== "string",
      ) ||
      new Set(habit.completions.map((item) => item.id)).size !==
        habit.completions.length
    )
      throw new HabitError(
        "В локальных данных есть ошибка. Исходная копия сохранена.",
      );
    const steps = habit.completions.map((item, index) =>
      doc.schemaVersion === 1 ? index + 1 : item.step,
    );
    if (
      steps.some(
        (step) => !Number.isInteger(step) || step < 1 || step > habit.target,
      ) ||
      new Set(steps).size !== steps.length ||
      (doc.schemaVersion === 1 &&
        new Set(habit.completions.map((item) => item.day)).size !==
          habit.completions.length)
    )
      throw new HabitError(
        "В локальных данных есть ошибка. Исходная копия сохранена.",
      );
    ids.add(habit.id);
  }
  if (doc.schemaVersion === 1) {
    doc.schemaVersion = 2;
    for (const habit of doc.habits) {
      habit.completions = habit.completions.map((item, index) => ({
        ...item,
        step: index + 1,
      }));
    }
  }
  return doc;
}
export function applyCommand(
  doc,
  command,
  { now = new Date(), uuid = () => crypto.randomUUID() } = {},
) {
  const next = structuredClone(doc);
  const timestamp = now.toISOString();
  const day = dayKey(now);
  let payload;
  if (command.type === "habit.created") {
    const name = String(command.name ?? "").trim();
    const target = Number(command.target);
    if (!name || name.length > 80)
      throw new HabitError("Дай привычке название — от 1 до 80 символов.");
    if (!Number.isInteger(target) || target < 1 || target > 365)
      throw new HabitError("Выбери число выполнений от 1 до 365.");
    payload = {
      id: uuid(),
      name,
      target,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      completions: [],
    };
    next.habits.push(payload);
  } else {
    const habit = next.habits.find(
      (item) => item.id === command.habitId && !item.deletedAt,
    );
    if (!habit) throw new HabitError("Эта привычка уже удалена.");
    if (
      command.type === "completion.added" ||
      command.type === "completion.removed"
    ) {
      if (
        !Number.isInteger(command.step) ||
        command.step < 1 ||
        command.step > habit.target
      )
        throw new HabitError("Выбери существующий номер выполнения.");
    }
    if (command.type === "completion.added") {
      if (habit.completions.some((item) => item.step === command.step))
        throw new HabitError("Эта отметка уже есть.");
      if (habit.completions.length >= habit.target)
        throw new HabitError("Цель уже достигнута!");
      const completion = {
        id: uuid(),
        step: command.step,
        day,
        createdAt: timestamp,
      };
      habit.completions.push(completion);
      payload = { habitId: habit.id, completion };
    } else if (command.type === "completion.removed") {
      const completion = habit.completions.find(
        (item) => item.step === command.step,
      );
      if (!completion) throw new HabitError("Этой отметки пока нет.");
      habit.completions = habit.completions.filter(
        (item) => item.id !== completion.id,
      );
      payload = {
        habitId: habit.id,
        completionId: completion.id,
        step: completion.step,
        day: completion.day,
      };
    } else if (command.type === "habit.deleted") {
      habit.deletedAt = timestamp;
      payload = { habitId: habit.id, deletedAt: timestamp };
    } else throw new HabitError("Неизвестное действие.");
    habit.updatedAt = timestamp;
  }
  next.revision++;
  next.outbox.push({
    schemaVersion: 2,
    id: uuid(),
    workspaceId: doc.workspaceId,
    deviceId: doc.deviceId,
    type: command.type,
    payload: structuredClone(payload),
    createdAt: timestamp,
  });
  return next;
}
export function persistCommand(storage, command, options) {
  const current = readDocument(storage) ?? createDocument();
  const next = applyCommand(current, command, options);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new HabitError(
      "Не получилось сохранить. Возможно, память браузера заполнена. Изменение не применено.",
    );
  }
  return next;
}
