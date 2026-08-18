import { createGithubAdapter } from './githubAdapter'
import { createLocalAdapter } from './localAdapter'
import { createFileAdapter, loadFileHandle, queryFilePermission } from './fileAdapter'
import { isGithubConfigured, type SyncConfig } from './config'
import type { StorageAdapter } from './types'

export interface ResolvedAdapter {
  adapter: StorageAdapter
  /** modo pasta escolhido, mas nenhum arquivo selecionado ainda */
  needsFile: boolean
  /** modo pasta escolhido, arquivo conhecido, mas o navegador quer autorizacao */
  needsPermission: boolean
  /** handle em uso, para pedir a autorizacao a partir de um clique */
  handle: FileSystemFileHandle | null
}

/**
 * Escolhe o adaptador conforme o modo configurado. Se o modo pedido nao estiver
 * pronto (sem arquivo, sem token), cai no localStorage: o app nunca deixa de
 * abrir por causa de configuracao pendente.
 */
export async function resolveAdapter(config: SyncConfig): Promise<ResolvedAdapter> {
  const fallback: ResolvedAdapter = {
    adapter: createLocalAdapter(),
    needsFile: false,
    needsPermission: false,
    handle: null,
  }

  if (config.mode === 'file') {
    const handle = await loadFileHandle()
    if (!handle) return { ...fallback, needsFile: true }
    const permission = await queryFilePermission(handle)
    return {
      adapter: createFileAdapter(handle),
      needsFile: false,
      needsPermission: permission !== 'granted',
      handle,
    }
  }

  if (config.mode === 'github' && isGithubConfigured(config)) {
    return { ...fallback, adapter: createGithubAdapter(config) }
  }

  return fallback
}

export * from './types'
export * from './config'
export { testConnection } from './githubAdapter'
export { cacheBoard, readCachedBoard } from './localAdapter'
export { migrate } from './migrate'
export {
  createFileAdapter,
  forgetFile,
  isFileModeSupported,
  pickExistingFile,
  pickFileToSave,
  queryFilePermission,
  requestFilePermission,
  loadFileHandle,
} from './fileAdapter'
