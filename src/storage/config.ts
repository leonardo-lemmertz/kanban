const KEY = 'kanban.sync.config'

export interface GithubConfig {
  token: string
  owner: string
  repo: string
  path: string
  branch: string
}

export const DEFAULT_CONFIG: GithubConfig = {
  token: '',
  owner: '',
  repo: 'kanban-data',
  path: 'board.json',
  branch: 'main',
}

export function readConfig(): GithubConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<GithubConfig>) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function writeConfig(config: GithubConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config))
}

export function clearConfig(): void {
  localStorage.removeItem(KEY)
}

/** Sync so liga com token + owner + repo preenchidos. */
export function isSyncConfigured(config: GithubConfig): boolean {
  return config.token.trim() !== '' && config.owner.trim() !== '' && config.repo.trim() !== ''
}
