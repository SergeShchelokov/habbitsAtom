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
const options = (date = "2026-10-19T10:00:00") => ({
  now: new Date(date),
  uuid: () => crypto.randomUUID(),
});
function fixture(target = 40) {
  const doc = applyCommand(
    createDocument(),
    { type: "habit.created", name: "  Читать  ", target },
    options(),
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
const mark = (doc, id, step, date) =>
  applyCommand(
    doc,
    { type: "completion.added", habitId: id, step },
    options(date),
  );
const undo = (doc, id, step, date) =>
  applyCommand(
    doc,
    { type: "completion.removed", habitId: id, step },
    options(date),
  );

test("creation trims name and keeps an immutable queued payload and stable owner", () => {
  const { doc, id } = fixture();
  const updated = mark(doc, id, 1);
  assert.equal(doc.habits[0].name, "Читать");
  assert.equal(updated.workspaceId, doc.workspaceId);
  assert.equal(updated.outbox[0].payload.completions.length, 0);
  assert.equal(updated.outbox.at(-1).schemaVersion, 2);
  assert.equal(updated.outbox.at(-1).payload.completion.step, 1);
});

test("any numbered steps can be marked in the same day and survive reload", () => {
  const { doc, id } = fixture();
  const updated = [8, 2, 5].reduce((state, step) => mark(state, id, step), doc);
  const restored = readDocument(memory(JSON.stringify(updated)));
  assert.deepEqual(
    restored.habits[0].completions.map((item) => item.step),
    [8, 2, 5],
  );
  assert.equal(
    new Set(restored.habits[0].completions.map((item) => item.day)).size,
    1,
  );
  assert.equal(restored.habits[0].completions.length, 3);
});

test("undo targets the selected number only, including on a different day", () => {
  const { doc, id } = fixture();
  const updated = [1, 2, 5].reduce((state, step) => mark(state, id, step), doc);
  const removed = undo(updated, id, 2, "2026-10-25T12:00:00");
  assert.deepEqual(
    removed.habits[0].completions.map((item) => item.step),
    [1, 5],
  );
  assert.equal(removed.outbox.at(-1).payload.step, 2);
  const again = mark(removed, id, 2, "2026-10-25T12:01:00");
  assert.equal(again.habits[0].completions.length, 3);
});

test("duplicate marks and invalid step numbers do not change progress or queue", () => {
  const { doc, id } = fixture(2);
  const first = mark(doc, id, 1);
  const raw = JSON.stringify(first);
  assert.throws(() => mark(first, id, 1), /уже есть/);
  for (const step of [0, -1, 1.5, 3, NaN, Infinity, "1", undefined]) {
    assert.throws(() => mark(first, id, step));
    assert.throws(() => undo(first, id, step));
  }
  assert.throws(() => undo(first, id, 2), /пока нет/);
  assert.equal(JSON.stringify(first), raw);
});

test("all steps can finish in one day; undo reopens the completed goal", () => {
  const { doc, id } = fixture(3);
  const done = [3, 1, 2].reduce((state, step) => mark(state, id, step), doc);
  assert.equal(done.habits[0].completions.length, 3);
  assert.throws(() => mark(done, id, 4));
  assert.throws(() => mark(done, id, 1));
  const reopened = undo(done, id, 2);
  assert.equal(reopened.habits[0].completions.length, 2);
  assert.equal(mark(reopened, id, 2).habits[0].completions.length, 3);
});

test("legacy daily records migrate to numbered steps without writing during read", () => {
  const legacy = {
    schemaVersion: 1,
    revision: 3,
    workspaceId: "owner-1",
    deviceId: "device-1",
    habits: [
      {
        id: "habit-1",
        name: "Читать",
        target: 40,
        createdAt: "2026-10-18T10:00:00Z",
        updatedAt: "2026-10-19T10:00:00Z",
        deletedAt: null,
        completions: [
          {
            id: "completion-1",
            day: "2026-10-18",
            createdAt: "2026-10-18T10:00:00Z",
          },
          {
            id: "completion-2",
            day: "2026-10-19",
            createdAt: "2026-10-19T10:00:00Z",
          },
        ],
      },
    ],
    outbox: [
      {
        id: "legacy-event",
        type: "completion.added",
        payload: {
          habitId: "habit-1",
          completion: {
            id: "completion-2",
            day: "2026-10-19",
            createdAt: "2026-10-19T10:00:00Z",
          },
        },
      },
    ],
  };
  const raw = JSON.stringify(legacy);
  const storage = memory(raw);
  const migrated = readDocument(storage);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(
    migrated.habits[0].completions.map((item) => item.step),
    [1, 2],
  );
  assert.deepEqual(
    migrated.habits[0].completions.map((item) => item.id),
    ["completion-1", "completion-2"],
  );
  assert.deepEqual(migrated.outbox, legacy.outbox);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  const updated = persistCommand(
    storage,
    { type: "completion.added", habitId: "habit-1", step: 3 },
    options(),
  );
  assert.equal(updated.habits[0].completions.length, 3);
  assert.equal(updated.workspaceId, legacy.workspaceId);
  assert.equal(readDocument(storage).schemaVersion, 2);
  assert.deepEqual(updated.outbox[0], legacy.outbox[0]);
});

test("deletion keeps a tombstone and blocks further completion edits", () => {
  const { doc, id } = fixture();
  const done = mark(doc, id, 4);
  const deleted = applyCommand(done, { type: "habit.deleted", habitId: id });
  assert.ok(deleted.habits[0].deletedAt);
  assert.equal(deleted.habits[0].completions[0].step, 4);
  assert.equal(deleted.outbox.at(-1).type, "habit.deleted");
  assert.throws(() => mark(deleted, id, 5), /удалена/);
});

test("invalid habit input never modifies original state", () => {
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

test("storage quota failure preserves both previous progress and operation queue", () => {
  const { doc, id } = fixture();
  const raw = JSON.stringify(doc);
  const storage = {
    getItem: () => raw,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.throws(
    () =>
      persistCommand(storage, {
        type: "completion.added",
        habitId: id,
        step: 2,
      }),
    /не применено/,
  );
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test("corrupted and future data is preserved without overwriting", () => {
  const { doc } = fixture();
  const duplicate = structuredClone(doc);
  duplicate.habits[0].completions = [
    { id: "a", day: "2026-10-19", step: 1 },
    { id: "b", day: "2026-10-19", step: 1 },
  ];
  for (const raw of [
    "broken-json",
    '{"schemaVersion":3}',
    '{"schemaVersion":1}',
    JSON.stringify(duplicate),
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

test("sequential clients re-read storage and retain all independent marks", () => {
  const storage = memory();
  const created = persistCommand(storage, {
    type: "habit.created",
    name: "Бокс",
    target: 40,
  });
  const id = created.habits[0].id;
  persistCommand(
    storage,
    { type: "completion.added", habitId: id, step: 7 },
    options(),
  );
  persistCommand(
    storage,
    { type: "completion.added", habitId: id, step: 2 },
    options(),
  );
  const restored = readDocument(storage);
  assert.deepEqual(
    restored.habits[0].completions.map((item) => item.step),
    [7, 2],
  );
  assert.equal(restored.outbox.length, 3);
  assert.equal(restored.revision, 3);
});

test("completion dates remain local calendar metadata, without limiting clicks", () => {
  assert.equal(dayKey(new Date(2026, 9, 19, 0, 1)), "2026-10-19");
  assert.equal(dayKey(new Date(2026, 9, 18, 23, 59)), "2026-10-18");
});
