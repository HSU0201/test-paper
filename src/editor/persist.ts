/** 用 IndexedDB 暫存草稿：容量比 localStorage 大，題目圖片（data URL）也放得下 */
const DB_NAME = 'testpaper-editor'
const STORE = 'drafts'
const KEY = 'current'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

export type Draft = { savedAt: number; doc: unknown }

export function loadDraft(): Promise<Draft | null> {
  return tx<Draft | undefined>('readonly', (s) => s.get(KEY) as IDBRequest<Draft | undefined>)
    .then((d) => d ?? null)
    .catch(() => null)
}

export function saveDraft(doc: unknown): Promise<number> {
  const savedAt = Date.now()
  return tx('readwrite', (s) => s.put({ savedAt, doc } satisfies Draft, KEY)).then(() => savedAt)
}
