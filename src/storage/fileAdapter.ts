import type { Board } from '../types'
import { PermissionError, type StorageAdapter } from './types'
import { migrate } from './migrate'
import { clearFileHandle, loadFileHandle, saveFileHandle } from './handleStore'

/**
 * Adaptador de arquivo local, via File System Access API.
 *
 * Grava o board direto num arquivo escolhido pelo usuario (por exemplo em
 * J:\Projetos\kanban-data\board.json). Nao envolve token nem rede: quem faz o
 * backup e o proprio lugar onde o arquivo mora.
 *
 * Limitacoes que vem da API, nao da nossa implementacao:
 * - so Chromium (Chrome/Edge). Firefox e Safari nao expoem showSaveFilePicker.
 * - escolher o arquivo exige clique do usuario; nao da para reabrir sozinho.
 * - o navegador pode pedir a autorizacao de escrita de novo em outra sessao.
 */

/* A tipagem da API varia entre versoes do lib.dom, entao acessamos os pontos
   instaveis por cast em vez de redeclarar as interfaces (o que colidiria). */
interface PickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
  excludeAcceptAllOption?: boolean
  id?: string
}

type WindowWithPickers = Window & {
  showSaveFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle>
  showOpenFilePicker?: (options?: PickerOptions & { multiple?: boolean }) => Promise<FileSystemFileHandle[]>
}

type PermissionDescriptor = { mode: 'read' | 'readwrite' }

type HandleWithPermissions = FileSystemFileHandle & {
  queryPermission?: (descriptor: PermissionDescriptor) => Promise<PermissionState>
  requestPermission?: (descriptor: PermissionDescriptor) => Promise<PermissionState>
  createWritable?: (options?: { keepExistingData?: boolean }) => Promise<{
    write: (data: string) => Promise<void>
    close: () => Promise<void>
  }>
}

const PICKER_OPTIONS: PickerOptions = {
  suggestedName: 'board.json',
  id: 'kanban-board',
  types: [{ description: 'Board do kanban (JSON)', accept: { 'application/json': ['.json'] } }],
}

export function isFileModeSupported(): boolean {
  return typeof (window as WindowWithPickers).showSaveFilePicker === 'function'
}

/** Abre o seletor para criar/sobrescrever um arquivo. Devolve null se cancelar. */
export async function pickFileToSave(): Promise<FileSystemFileHandle | null> {
  const picker = (window as WindowWithPickers).showSaveFilePicker
  if (!picker) throw new Error('Este navegador não permite gravar em arquivo. Use o Chrome ou o Edge.')
  try {
    const handle = await picker(PICKER_OPTIONS)
    await saveFileHandle(handle)
    return handle
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return null
    throw cause
  }
}

/** Abre o seletor para usar um arquivo que ja existe. Devolve null se cancelar. */
export async function pickExistingFile(): Promise<FileSystemFileHandle | null> {
  const picker = (window as WindowWithPickers).showOpenFilePicker
  if (!picker) throw new Error('Este navegador não permite abrir arquivo. Use o Chrome ou o Edge.')
  try {
    const [handle] = await picker({ ...PICKER_OPTIONS, multiple: false })
    if (!handle) return null
    await saveFileHandle(handle)
    return handle
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return null
    throw cause
  }
}

export async function queryFilePermission(handle: FileSystemFileHandle): Promise<PermissionState> {
  const query = (handle as HandleWithPermissions).queryPermission
  if (!query) return 'granted'
  return query.call(handle, { mode: 'readwrite' })
}

/** Precisa ser chamada a partir de um clique do usuario. */
export async function requestFilePermission(handle: FileSystemFileHandle): Promise<PermissionState> {
  const request = (handle as HandleWithPermissions).requestPermission
  if (!request) return 'granted'
  return request.call(handle, { mode: 'readwrite' })
}

export async function forgetFile(): Promise<void> {
  await clearFileHandle()
}

export { loadFileHandle }

function asPermissionProblem(cause: unknown): never {
  if (cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')) {
    throw new PermissionError()
  }
  if (cause instanceof DOMException && cause.name === 'NotFoundError') {
    throw new Error('O arquivo escolhido não existe mais (foi movido, renomeado ou apagado). Escolha outro em Configurações.')
  }
  throw cause
}

export function createFileAdapter(handle: FileSystemFileHandle): StorageAdapter {
  return {
    kind: 'file',

    async load() {
      try {
        const text = await (await handle.getFile()).text()
        if (text.trim() === '') return null
        return migrate(JSON.parse(text))
      } catch (cause) {
        asPermissionProblem(cause)
      }
    },

    async save(board: Board) {
      try {
        const createWritable = (handle as HandleWithPermissions).createWritable
        if (!createWritable) throw new Error('Este navegador não permite gravar em arquivo. Use o Chrome ou o Edge.')
        const writable = await createWritable.call(handle)
        await writable.write(`${JSON.stringify(board, null, 2)}\n`)
        await writable.close()
      } catch (cause) {
        asPermissionProblem(cause)
      }
    },
  }
}
