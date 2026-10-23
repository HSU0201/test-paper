/** 用 IndexedDB 暫存草稿：容量比 localStorage 大，題目圖片（data URL）也放得下 */
const DB_NAME = 'testpaper-editor'
const DRAFTS = 'drafts'
const SNAPSHOTS = 'snapshots'
const DRAFT_KEY = 'current'
const DB_VERSION = 2

/** 內容有變動時，每隔這段時間多留一份不會被下一筆暫存蓋掉的備份 */
export const SNAPSHOT_EVERY_MINUTES = 3
export const SNAPSHOT_INTERVAL_MS = SNAPSHOT_EVERY_MINUTES * 60 * 1000
export const MAX_SNAPSHOTS = 15

export type Draft = { savedAt: number; doc: unknown }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS)
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function request<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
        t.onerror = () => db.close()
      }),
  )
}

let lastStamp = 0

function nextStamp() {
  const now = Date.now()
  lastStamp = now > lastStamp ? now : lastStamp + 1
  return lastStamp
}

export function loadDraft(): Promise<Draft | null> {
  return request<Draft | undefined>(DRAFTS, 'readonly', (s) => s.get(DRAFT_KEY) as IDBRequest<Draft | undefined>)
    .then((d) => d ?? null)
    .catch(() => null)
}

export function saveDraft(doc: unknown): Promise<number> {
  const savedAt = Date.now()
  return request(DRAFTS, 'readwrite', (s) => s.put({ savedAt, doc } satisfies Draft, DRAFT_KEY)).then(() => savedAt)
}

/** 留下一份可還原的備份，並只保留最近幾份 */
export function saveSnapshot(doc: unknown): Promise<number> {
  const savedAt = nextStamp()
  const frozen = structuredClone(doc)
  return openDb().then(
    (db) =>
      new Promise<number>((resolve, reject) => {
        const t = db.transaction(SNAPSHOTS, 'readwrite')
        const store = t.objectStore(SNAPSHOTS)
        store.put({ savedAt, doc: frozen } satisfies Draft, savedAt)
        const keysReq = store.getAllKeys()
        keysReq.onsuccess = () => {
          const keys = [...(keysReq.result as number[])].sort((a, b) => a - b)
          const drop = keys.length - MAX_SNAPSHOTS
          for (let i = 0; i < drop; i++) store.delete(keys[i])
        }
        t.oncomplete = () => {
          db.close()
          resolve(savedAt)
        }
        t.onerror = () => {
          const err = t.error
          db.close()
          reject(err)
        }
      }),
  )
}

export function listSnapshots(): Promise<number[]> {
  return request<IDBValidKey[]>(SNAPSHOTS, 'readonly', (s) => s.getAllKeys())
    .then((keys) => keys.map((k) => Number(k)).sort((a, b) => b - a))
    .catch(() => [])
}

export function loadSnapshot(savedAt: number): Promise<Draft | null> {
  return request<Draft | undefined>(SNAPSHOTS, 'readonly', (s) => s.get(savedAt) as IDBRequest<Draft | undefined>)
    .then((d) => d ?? null)
    .catch(() => null)
}

/** 請瀏覽器不要在空間不足時清掉這個網站的暫存（不一定會同意） */
export function requestPersistentStorage(): void {
  void navigator.storage?.persist?.().catch(() => undefined)
}
