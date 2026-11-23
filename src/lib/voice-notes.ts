const DB_NAME = 'hab21:voice-notes'
const STORE_NAME = 'notes'

export type VoiceNote = {
  id: string
  createdAt: number
  durationMs: number
  audio: Blob
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    let blocked = false
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onblocked = () => {
      blocked = true
      reject(new Error('Голосовые заметки открыты в другой версии приложения.'))
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      if (blocked) request.result.close()
      else resolve(request.result)
    }
  })
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const request = action(tx.objectStore(STORE_NAME))
      tx.oncomplete = () => resolve(request.result)
      tx.onabort = () => reject(tx.error ?? new Error('Операция с голосовыми заметками прервана.'))
    })
  } finally {
    db.close()
  }
}

export async function listVoiceNotes(): Promise<VoiceNote[]> {
  const notes = await transaction<VoiceNote[]>('readonly', store => store.getAll())
  return notes.sort((a, b) => b.createdAt - a.createdAt)
}

export function saveVoiceNote(note: VoiceNote) {
  return transaction('readwrite', store => store.put(note))
}

export function deleteVoiceNote(id: string) {
  return transaction('readwrite', store => store.delete(id))
}
