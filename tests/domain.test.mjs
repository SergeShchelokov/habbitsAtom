import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  applyCommand,
  createDocument,
  readDocument,
  persistCommand,
  dayKey,
} from "../src/domain.mjs";
const options = (date) => ({
  now: new Date(date),
  uuid: () => crypto.randomUUID(),
});
function fixture(target = 40) {
  const doc = applyCommand(
    createDocument(),
    { type: "habit.created", name: "  Читать  ", target },
    options("2026-10-19T10:00:00"),
  );
  return { doc, id: doc.habits[0].id };
}
function memory(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_, next) => {
      value = next;
    },
  };
}
test("creation trims name, keeps separate operation payload and stable owner", () => {
  const { doc, id } = fixture();
  assert.equal(doc.habits[0].name, "Читать");
  assert.equal(doc.outbox[0].payload.id, id);
  const updated = applyCommand(
    doc,
    { type: "completion.added", habitId: id },
    options("2026-10-19T12:00:00"),
  );
  assert.equal(updated.workspaceId, doc.workspaceId);
  assert.equal(updated.outbox[0].payload.completions.length, 0);
});
test("daily limit survives serialization; today can be undone and marked again", () => {
  const { doc, id } = fixture();
  const command = { type: "completion.added", habitId: id };
  const first = applyCommand(doc, command, options("2026-10-19T12:00:00"));
  const persisted = readDocument(memory(JSON.stringify(first)));
  assert.throws(
    () => applyCommand(persisted, command, options("2026-10-19T23:59:59")),
    /уже всё/,
  );
  const undone = applyCommand(
    persisted,
    { type: "completion.removed", habitId: id },
    options("2026-10-19T13:00:00"),
  );
  const again = applyCommand(undone, command, options("2026-10-19T14:00:00"));
  assert.equal(again.habits[0].completions.length, 1);
});
test("missed days preserve progress; past completions cannot be undone today", () => {
  const { doc, id } = fixture();
  const first = applyCommand(
    doc,
    { type: "completion.added", habitId: id },
    options("2026-10-19T12:00:00"),
  );
  assert.throws(
    () =>
      applyCommand(
        first,
        { type: "completion.removed", habitId: id },
        options("2026-10-25T12:00:00"),
      ),
    /пока нет/,
  );
  const later = applyCommand(
    first,
    { type: "completion.added", habitId: id },
    options("2026-10-25T12:00:00"),
  );
  assert.equal(later.habits[0].completions.length, 2);
});
test("goal cannot be exceeded; deletion keeps tombstone and queued operation", () => {
  const { doc, id } = fixture(1);
  const done = applyCommand(
    doc,
    { type: "completion.added", habitId: id },
    options("2026-10-19T12:00:00"),
  );
  assert.throws(
    () =>
      applyCommand(
        done,
        { type: "completion.added", habitId: id },
        options("2026-10-20T12:00:00"),
      ),
    /достигнута/,
  );
  const deleted = applyCommand(done, { type: "habit.deleted", habitId: id });
  assert.ok(deleted.habits[0].deletedAt);
  assert.equal(deleted.outbox.at(-1).type, "habit.deleted");
  assert.throws(
    () => applyCommand(deleted, { type: "completion.added", habitId: id }),
    /удалена/,
  );
});
test("invalid input never modifies original state", () => {
  const doc = createDocument();
  for (const target of [0, -1, 1.5, 366, NaN, Infinity, ""])
    assert.throws(() =>
      applyCommand(doc, { type: "habit.created", name: "test", target }),
    );
  for (const name of ["", " ", "a".repeat(81)])
    assert.throws(() =>
      applyCommand(doc, { type: "habit.created", name, target: 40 }),
    );
  assert.equal(doc.habits.length, 0);
});
test("atomic persistence preserves prior state when storage quota is exceeded", () => {
  const { doc, id } = fixture();
  const raw = JSON.stringify(doc);
  const storage = {
    getItem: () => raw,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.throws(
    () => persistCommand(storage, { type: "completion.added", habitId: id }),
    /не применено/,
  );
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
test("corrupted or future data is preserved without overwriting", () => {
  for (const raw of [
    "broken-json",
    '{"schemaVersion":2}',
    '{"schemaVersion":1}',
  ]) {
    const storage = memory(raw);
    assert.throws(() =>
      persistCommand(storage, {
        type: "habit.created",
        name: "test",
        target: 40,
      }),
    );
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});
test("each write reads current storage so independent sequential clients do not overwrite", () => {
  const storage = memory();
  persistCommand(storage, { type: "habit.created", name: "Бокс", target: 40 });
  const doc = persistCommand(storage, {
    type: "habit.created",
    name: "Читать",
    target: 10,
  });
  assert.equal(doc.habits.length, 2);
  assert.equal(doc.outbox.length, 2);
  assert.equal(readDocument(storage).revision, 2);
});
test("day key uses local calendar date, including midnight boundary", () => {
  assert.equal(dayKey(new Date(2026, 9, 19, 0, 1)), "2026-10-19");
  assert.equal(dayKey(new Date(2026, 9, 18, 23, 59)), "2026-10-18");
});
