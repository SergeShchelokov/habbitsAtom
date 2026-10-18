import { useEffect, useRef, useState } from "react";
import {
  Lightning,
  PlusCircle,
  Check,
  X,
  Trash,
  WifiSlash,
  HardDrives,
  ArrowRight,
} from "@phosphor-icons/react";
import {
  STORAGE_KEY,
  HabitError,
  readDocument,
  persistCommand,
} from "./domain.mjs";
const appBootId = crypto.randomUUID();

function Modal({ label, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    (
      ref.current.querySelector("input") ||
      ref.current.querySelector(".secondary")
    )?.focus();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="icon-button close-button"
        aria-label="Закрыть окно"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      {children}
    </dialog>
  );
}

function CreateHabit({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("40");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onCreate({ type: "habit.created", name, target });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal label="Новая привычка" onClose={onClose}>
      <div className="modal-symbol">
        <Lightning size={29} weight="fill" />
      </div>
      <p className="eyebrow">ОДНО МАЛЕНЬКОЕ НАЧАЛО</p>
      <h1>Новая привычка</h1>
      <p className="modal-intro">Не меняем всю жизнь. Начнём с одной штуки.</p>
      <form onSubmit={submit}>
        <label htmlFor="habit-name">Что будем делать?</label>
        <input
          id="habit-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          required
          maxLength={80}
          placeholder="Например, ходить на бокс"
          autoComplete="off"
        />
        <label htmlFor="habit-target">Сколько раз выполнить?</label>
        <div className="number-field">
          <input
            id="habit-target"
            type="number"
            inputMode="numeric"
            min="1"
            max="365"
            step="1"
            required
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
          <span>раз</span>
        </div>
        <p className="field-hint">
          Нажимай на числа, когда дело сделано.
          <br className="desktop-break" /> Сколько раз в день — решать тебе.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary create-submit" disabled={busy}>
          {busy ? "Сохраняем…" : "Создать привычку"}
          <ArrowRight size={20} />
        </button>
      </form>
    </Modal>
  );
}

function HabitRow({ habit, onCommand, onDelete, busy }) {
  const count = habit.completions.length;
  const complete = count === habit.target;
  const completedSteps = new Set(habit.completions.map((item) => item.step));
  return (
    <article
      className={`habit-row ${complete ? "is-complete" : ""}`}
      aria-label={habit.name}
    >
      <div className="habit-meta">
        <p className="habit-count">
          {count} из {habit.target}
          {complete && <Check size={14} weight="bold" />}
        </p>
        <h2>{habit.name}</h2>
        {complete && <p className="done-copy">Готово. А ты сомневался.</p>}
      </div>
      <div className="habit-progress">
        <img
          className="habit-symbol"
          src="./assets/icon-habbit.svg"
          alt=""
          aria-hidden="true"
        />
        <div
          className="habit-track"
          tabIndex={0}
          role="group"
          aria-label={`Прогресс: ${count} из ${habit.target}. Цепочку можно прокрутить.`}
        >
          {Array.from({ length: habit.target }, (_, i) => {
            const step = i + 1;
            const done = completedSteps.has(step);
            return (
              <button
                key={step}
                type="button"
                data-step={step}
                className={`step ${done ? "step-completed" : ""}`}
                aria-pressed={done}
                aria-label={`${done ? "Отменить отметку" : "Выполнить"} ${step}: ${habit.name}`}
                title={done ? `Отменить отметку ${step}` : `Выполнить ${step}`}
                disabled={busy}
                onClick={() =>
                  onCommand({
                    type: done ? "completion.removed" : "completion.added",
                    habitId: habit.id,
                    step,
                  })
                }
              >
                {done ? (
                  <img
                    src="./assets/icon-habbit.svg"
                    alt=""
                    aria-hidden="true"
                  />
                ) : (
                  step
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="row-actions">
        <button
          className="icon-button delete-button"
          title="Удалить привычку"
          aria-label={`Удалить привычку: ${habit.name}`}
          disabled={busy}
          onClick={() => onDelete(habit)}
        >
          <Trash size={19} />
        </button>
      </div>
    </article>
  );
}

export function App() {
  const [doc, setDoc] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState({ text: "", id: 0 });
  const message = notice.text;
  const setMessage = (text) =>
    setNotice((current) => ({ text, id: current.id + 1 }));
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const pending = useRef(false);
  function refresh() {
    try {
      setDoc(readDocument(localStorage));
      setStorageError("");
    } catch (e) {
      setStorageError(
        e.message || "Браузер не разрешает доступ к локальному хранилищу.",
      );
    }
  }
  useEffect(() => {
    refresh();
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY || event.key === null) refresh();
    };
    const onOnline = () => setOnline(navigator.onLine);
    const onFocus = () => {
      refresh();
    };
    addEventListener("storage", onStorage);
    addEventListener("online", onOnline);
    addEventListener("offline", onOnline);
    addEventListener("focus", onFocus);
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register("./sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false));
    }
    return () => {
      removeEventListener("storage", onStorage);
      removeEventListener("online", onOnline);
      removeEventListener("offline", onOnline);
      removeEventListener("focus", onFocus);
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [notice.id]);
  async function command(action) {
    if (pending.current)
      throw new HabitError("Секунду, сохраняем предыдущее действие.");
    if (storageError) throw new HabitError(storageError);
    pending.current = true;
    setBusy(true);
    try {
      const write = () => {
        const updated = persistCommand(localStorage, action);
        setDoc(updated);
      };
      if (navigator.locks) await navigator.locks.request(STORAGE_KEY, write);
      else write();
      setMessage(
        action.type === "habit.created"
          ? "Привычка создана. Самое время начать."
          : action.type === "completion.added"
            ? "Дело сделано!"
            : action.type === "completion.removed"
              ? "Отметку отменили. Бывает."
              : "Привычка удалена.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const run = (action) => command(action).catch((e) => setMessage(e.message));
  const habits = doc?.habits.filter((habit) => !habit.deletedAt) ?? [];
  function backup() {
    try {
      const url = URL.createObjectURL(
        new Blob([localStorage.getItem(STORAGE_KEY) ?? ""], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "habbits-local-backup.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage("Не удалось прочитать хранилище. Проверь настройки браузера.");
    }
  }
  return (
    <div className="app-shell" data-boot-id={appBootId}>
      <aside className="sidebar" aria-label="Панель привычек">
        <a className="brand-link" href="./" aria-label="На главную">
          <img
            className="brand"
            src="./assets/brand.png"
            alt="21 — трекер привычек"
            width="110"
            height="88"
          />
        </a>
        <button
          className="add-button"
          onClick={() => setCreating(true)}
          disabled={!!storageError}
          aria-label="Добавить привычку"
          title="Добавить привычку"
        >
          <PlusCircle size={39} weight="bold" />
        </button>
        <span className="sidebar-caption">ШАГ ЗА ШАГОМ</span>
      </aside>
      <main>
        <header className="page-header">
          <span className="page-caption">ТВОИ ПРИВЫЧКИ</span>
          <div
            className={`storage-status ${!online ? "is-offline" : ""}`}
            title={
              online
                ? "Сохранение на этом устройстве. Облачная синхронизация пока не подключена."
                : "Изменения сохраняются на этом устройстве."
            }
          >
            {online ? <HardDrives size={15} /> : <WifiSlash size={15} />}
            <span>
              {storageError
                ? "Ошибка хранилища"
                : online
                  ? "На этом устройстве"
                  : "Без интернета · сохранено"}
            </span>
          </div>
        </header>
        {storageError && (
          <div className="storage-error" role="alert">
            {storageError}
            <button onClick={backup}>Скачать исходные данные</button>
          </div>
        )}
        {!habits.length ? (
          <section className="empty-state">
            <div className="empty-symbol">
              <img src="./assets/empty-coin.png" alt="" aria-hidden="true" />
            </div>
            <p className="eyebrow">НУ ЧТО, НАЧНЁМ?</p>
            <h1>
              Большие планы начинаются
              <br />с одной привычки.
            </h1>
            <p>Можно даже не ждать понедельника.</p>
            <button
              className="primary"
              onClick={() => setCreating(true)}
              disabled={!!storageError}
            >
              <PlusCircle size={21} />
              Добавить привычку
            </button>
            <span className="empty-footnote">
              Каждый шаг считается. В своём темпе.
            </span>
          </section>
        ) : (
          <section className="habit-list" aria-label="Список привычек">
            {habits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                onCommand={run}
                onDelete={(habit) => {
                  setDeleteError("");
                  setDeleting(habit);
                }}
                busy={busy || !!storageError}
              />
            ))}
            <p className="list-footnote">Маленькие шаги тоже считаются.</p>
          </section>
        )}
        <footer className="page-footer">
          <span>БЕЗ ГОНКИ. БЕЗ ОБНУЛЕНИЙ.</span>
          <span>
            {offlineReady
              ? "Можно открывать без интернета"
              : "v0.1 · маленькое начало"}
          </span>
        </footer>
      </main>
      {creating && (
        <CreateHabit onClose={() => setCreating(false)} onCreate={command} />
      )}
      {deleting && (
        <Modal label="Удалить привычку?" onClose={() => setDeleting(null)}>
          <div className="modal-symbol">
            <Trash size={27} />
          </div>
          <h1>Удалить привычку?</h1>
          <p className="delete-description">
            «{deleting.name}» и все её отметки исчезнут из списка. Вернуть их не
            получится.
          </p>
          {deleteError && (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="delete-actions">
            <button className="secondary" onClick={() => setDeleting(null)}>
              Оставить
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                try {
                  await command({
                    type: "habit.deleted",
                    habitId: deleting.id,
                  });
                  setDeleting(null);
                } catch (e) {
                  setDeleteError(e.message);
                }
              }}
            >
              Удалить
            </button>
          </div>
        </Modal>
      )}
      <div
        className={`toast ${message ? "toast-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        <span key={notice.id}>{message}</span>
      </div>
    </div>
  );
}
