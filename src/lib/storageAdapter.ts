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

let activeStore: Store | null = null

function getStore(): Store {
  if (activeStore) return activeStore

  const ls = probe(localStorage)
  const ss = ls ? null : probe(sessionStorage)
  activeStore = ls ?? ss ?? {
    getItem: (key) => memoryStore[key] ?? null,
    setItem: (key, value) => { memoryStore[key] = value },
    removeItem: (key) => { delete memoryStore[key] },
  }
  return activeStore
}

export const storageAdapter: Store = {
  getItem: (key) => getStore().getItem(key),
  setItem: (key, value) => { getStore().setItem(key, value) },
  removeItem: (key) => { getStore().removeItem(key) },
}
