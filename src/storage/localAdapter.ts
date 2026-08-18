import type { Board } from '../types'
import type { StorageAdapter } from './types'
import { migrate } from './migrate'

const KEY = 'kanban.board'

export function createLocalAdapter(): StorageAdapter {
  return {
    kind: 'local',
    async load() {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      return migrate(JSON.parse(raw))
    },
    async save(board: Board) {
      localStorage.setItem(KEY, JSON.stringify(board))
    },
  }
}

/** Copia local mantida tambem no modo GitHub, para abrir offline. */
export function cacheBoard(board: Board): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(board))
  } catch {
    /* quota cheia: ignora, o remoto e a fonte de verdade */
  }
}

export function readCachedBoard(): Board | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return migrate(JSON.parse(raw))
  } catch {
    return null
  }
}
