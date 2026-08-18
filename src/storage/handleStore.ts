/**
 * Guarda o handle do arquivo escolhido pelo usuario.
 *
 * Handle de arquivo nao serializa em JSON, entao nao cabe no localStorage --
 * o IndexedDB e o unico lugar do navegador que aceita guardar o objeto e
 * devolve-lo em outra sessao ainda apontando para o mesmo arquivo em disco.
 */

const DB_NAME = 'kanban'
const STORE = 'handles'
const KEY = 'board-file'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o IndexedDB.'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result as T)
      request.onerror = () => reject(request.error ?? new Error('Falha ao acessar o IndexedDB.'))
    })
  } finally {
    db.close()
  }
}

export async function saveFileHandle(handle: FileSystemFileHandle): Promise<void> {
  await withStore<void>('readwrite', (store) => store.put(handle, KEY))
}

export async function loadFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    return (await withStore<FileSystemFileHandle | undefined>('readonly', (store) => store.get(KEY))) ?? null
  } catch {
    return null
  }
}

export async function clearFileHandle(): Promise<void> {
  try {
    await withStore<void>('readwrite', (store) => store.delete(KEY))
  } catch {
    /* nada a limpar */
  }
}
