import { createGithubAdapter } from './githubAdapter'
import { createLocalAdapter } from './localAdapter'
import { isSyncConfigured, readConfig, type GithubConfig } from './config'
import type { StorageAdapter } from './types'

export function createAdapter(config: GithubConfig = readConfig()): StorageAdapter {
  return isSyncConfigured(config) ? createGithubAdapter(config) : createLocalAdapter()
}

export * from './types'
export * from './config'
export { testConnection } from './githubAdapter'
export { cacheBoard, readCachedBoard } from './localAdapter'
export { migrate } from './migrate'
