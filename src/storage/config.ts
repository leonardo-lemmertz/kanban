const KEY = 'kanban.sync.config'

/** Onde o board e gravado. Um modo por vez. */
export type StorageMode = 'local' | 'file' | 'github'

export interface GithubConfig {
  token: string
  owner: string
  repo: string
  path: string
  branch: string
}

export interface SyncConfig extends GithubConfig {
  mode: StorageMode
}

export const DEFAULT_CONFIG: SyncConfig = {
  mode: 'local',
  token: '',
  owner: '',
  repo: 'kanban-data',
  path: 'board.json',
  branch: 'main',
}

/** Sync por GitHub so liga com token + owner + repo preenchidos. */
export function isGithubConfigured(config: GithubConfig): boolean {
  return config.token.trim() !== '' && config.owner.trim() !== '' && config.repo.trim() !== ''
}

export function readConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const stored = JSON.parse(raw) as Partial<SyncConfig>
    const config = { ...DEFAULT_CONFIG, ...stored }
    // Config gravada antes de existir o modo pasta: deduz pelo que esta preenchido.
    if (stored.mode === undefined) config.mode = isGithubConfigured(config) ? 'github' : 'local'
    return config
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function writeConfig(config: SyncConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config))
}

export function clearConfig(): void {
  localStorage.removeItem(KEY)
}
