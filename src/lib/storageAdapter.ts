interface Store {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const memoryStore: Record<string, string> = {}

function createStore(storage: Storage): Store {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => { storage.setItem(key, value) },
    removeItem: (key) => { storage.removeItem(key) },
  }
}

function probe(storage: Storage): Store | null {
  try {
    const key = '__squill_probe__'
    storage.setItem(key, '1')
    storage.removeItem(key)
    return createStore(storage)
  } catch {
    return null
  }
}

const ls = probe(localStorage)
const ss = ls ? null : probe(sessionStorage)

export const storageAdapter: Store = ls ?? ss ?? {
  getItem: (key) => memoryStore[key] ?? null,
  setItem: (key, value) => { memoryStore[key] = value },
  removeItem: (key) => { delete memoryStore[key] },
}
