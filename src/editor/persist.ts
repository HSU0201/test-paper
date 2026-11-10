/** 用 IndexedDB 暫存草稿：容量比 localStorage 大，題目圖片（data URL）也放得下 */
const DB_NAME = 'testpaper-editor'
const DRAFTS = 'drafts'
const SNAPSHOTS = 'snapshots'
const DRAFT_KEY = 'current'
const DB_VERSION = 3
/** 我的題庫與頁首範本 */
const LIBRARY = 'library'

/** 內容有變動時，每隔這段時間多留一份不會被下一筆暫存蓋掉的備份 */
export const SNAPSHOT_EVERY_MINUTES = 3
export const SNAPSHOT_INTERVAL_MS = SNAPSHOT_EVERY_MINUTES * 60 * 1000
export const MAX_SNAPSHOTS = 15

export type Draft = { savedAt: number; doc: unknown }

/** 自動暫存很頻繁，連線開一次就重複使用；被瀏覽器關掉時下次再重開 */
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS)
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS)
      if (!db.objectStoreNames.contains(LIBRARY)) db.createObjectStore(LIBRARY, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      const db = req.result
      const forget = () => {
        if (dbPromise === opened) dbPromise = null
      }
      // 另一個分頁要升級資料庫時讓出連線
      db.onversionchange = () => {
        db.close()
        forget()
      }
      db.onclose = forget
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
  const opened = dbPromise
  opened.catch(() => {
    if (dbPromise === opened) dbPromise = null
  })
  return opened
}

/** 開交易；連線剛好失效時重開一次 */
function transaction(store: string, mode: IDBTransactionMode): Promise<IDBTransaction> {
  return openDb().then((db) => {
    try {
      return db.transaction(store, mode)
    } catch {
      dbPromise = null
      return openDb().then((fresh) => fresh.transaction(store, mode))
    }
  })
}

function request<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return transaction(store, mode).then(
    (t) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
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
  return transaction(SNAPSHOTS, 'readwrite').then(
    (t) =>
      new Promise<number>((resolve, reject) => {
        const store = t.objectStore(SNAPSHOTS)
        store.put({ savedAt, doc: frozen } satisfies Draft, savedAt)
        const keysReq = store.getAllKeys()
        keysReq.onsuccess = () => {
          const keys = [...(keysReq.result as number[])].sort((a, b) => a - b)
          const drop = keys.length - MAX_SNAPSHOTS
          for (let i = 0; i < drop; i++) store.delete(keys[i])
        }
        t.oncomplete = () => resolve(savedAt)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
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

/** section：存起來的大題；template：頁首、紙張與字級範本；paper：「我的考卷」裡的整份試卷 */
export type LibraryKind = 'section' | 'template' | 'paper'

export type LibraryItem<T = unknown> = {
  id: string
  kind: LibraryKind
  name: string
  savedAt: number
  /** 清單上的簡短說明，例如題數 */
  note: string
  data: T
}

export function listLibrary<T = unknown>(kind: LibraryKind): Promise<LibraryItem<T>[]> {
  return request<LibraryItem<T>[]>(LIBRARY, 'readonly', (s) => s.getAll() as IDBRequest<LibraryItem<T>[]>).then((all) =>
    all.filter((item) => item.kind === kind).sort((a, b) => b.savedAt - a.savedAt),
  )
}

export function saveLibraryItem<T>(item: Omit<LibraryItem<T>, 'id' | 'savedAt'> & { id?: string }): Promise<LibraryItem<T>> {
  const full: LibraryItem<T> = { ...item, id: item.id ?? crypto.randomUUID(), savedAt: nextStamp(), data: structuredClone(item.data) }
  return request(LIBRARY, 'readwrite', (s) => s.put(full)).then(() => {
    notifyLibrary()
    return full
  })
}

export function deleteLibraryItem(id: string): Promise<void> {
  return request(LIBRARY, 'readwrite', (s) => s.delete(id)).then(() => notifyLibrary())
}

/** 題庫有變動時通知畫面重新讀取 */
const libraryListeners = new Set<() => void>()

export function onLibraryChange(fn: () => void): () => void {
  libraryListeners.add(fn)
  return () => {
    libraryListeners.delete(fn)
  }
}

function notifyLibrary() {
  libraryListeners.forEach((fn) => fn())
}
