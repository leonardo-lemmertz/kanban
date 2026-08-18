import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Board } from '../types'
import {
  AuthError,
  ConflictError,
  OfflineError,
  PermissionError,
  cacheBoard,
  readCachedBoard,
  readConfig,
  requestFilePermission,
  resolveAdapter,
  writeConfig,
  type StorageAdapter,
  type SyncConfig,
} from '../storage'
import { createDebounced } from '../lib/debounce'
import { applyAction, type Action } from './boardReducer'
import { createSeedBoard } from './seed'

/** Janela de agrupamento: uma gravacao por rajada de alteracoes, nao por drag. */
const SAVE_DEBOUNCE_MS = 2000

export type SyncStatus =
  | 'loading'
  | 'local'
  | 'saved'
  | 'saving'
  | 'offline'
  | 'error'
  | 'conflict'
  /** modo pasta: o navegador quer autorizacao para gravar no arquivo */
  | 'permission'

export interface BoardApi {
  board: Board | null
  status: SyncStatus
  /** mensagem de erro exibida no banner, quando houver */
  error: string | null
  /** true quando o erro aponta para problema de token/permissao */
  needsSettings: boolean
  /** modo pasta escolhido, mas nenhum arquivo selecionado ainda */
  fileMissing: boolean
  /** versao remota que causou o conflito, aguardando decisao */
  conflictRemote: Board | null
  config: SyncConfig
  dispatch: (action: Action) => void
  reload: () => Promise<void>
  saveNow: () => void
  resolveConflict: (choice: 'remote' | 'local') => void
  saveConfig: (config: SyncConfig) => Promise<void>
  /** precisa ser chamada de dentro de um clique do usuario */
  grantFilePermission: () => Promise<void>
}

function composeMessage(messages: string[]): string {
  if (messages.length === 1) return messages[0]
  const extra = messages.length - 1
  return `${messages[0]} (+${extra} alteração${extra > 1 ? 'ões' : ''})`
}

export function useBoard(): BoardApi {
  const [config, setConfig] = useState<SyncConfig>(() => readConfig())
  const [board, setBoard] = useState<Board | null>(null)
  const [status, setStatus] = useState<SyncStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [needsSettings, setNeedsSettings] = useState(false)
  const [fileMissing, setFileMissing] = useState(false)
  const [conflictRemote, setConflictRemote] = useState<Board | null>(null)

  const adapterRef = useRef<StorageAdapter | null>(null)
  const handleRef = useRef<FileSystemFileHandle | null>(null)
  const boardRef = useRef<Board | null>(null)
  const messagesRef = useRef<string[]>([])
  const inFlightRef = useRef(false)
  const retryRef = useRef(false)

  const commit = useCallback((next: Board) => {
    boardRef.current = next
    setBoard(next)
    cacheBoard(next)
  }, [])

  const reportError = useCallback((cause: unknown) => {
    if (cause instanceof ConflictError) return
    if (cause instanceof PermissionError) {
      setStatus('permission')
      setError(null)
      setNeedsSettings(false)
      return
    }
    if (cause instanceof OfflineError) {
      setStatus('offline')
      setError('Sem conexão com o GitHub. As alterações ficam salvas neste aparelho e sobem quando a rede voltar.')
      setNeedsSettings(false)
      return
    }
    setStatus('error')
    setError(cause instanceof Error ? cause.message : String(cause))
    setNeedsSettings(cause instanceof AuthError)
  }, [])

  /** Grava de fato, com a mensagem agrupada da rajada. */
  const flush = useCallback(async () => {
    const adapter = adapterRef.current
    const current = boardRef.current
    if (!adapter || !current || messagesRef.current.length === 0) return
    if (inFlightRef.current) {
      retryRef.current = true
      return
    }

    const batch = messagesRef.current
    messagesRef.current = []
    inFlightRef.current = true
    setStatus('saving')

    try {
      await adapter.save(current, composeMessage(batch))
      setStatus('saved')
      setError(null)
      setNeedsSettings(false)
    } catch (cause) {
      // devolve as mensagens para a fila: a proxima tentativa mantem o contexto
      messagesRef.current = [...batch, ...messagesRef.current]
      if (cause instanceof ConflictError) {
        setStatus('conflict')
        try {
          const remote = await adapter.load()
          setConflictRemote(remote ?? current)
        } catch (loadCause) {
          reportError(loadCause)
        }
      } else {
        reportError(cause)
      }
    } finally {
      inFlightRef.current = false
    }
  }, [reportError])

  const debounced = useMemo(() => createDebounced(() => void flush(), SAVE_DEBOUNCE_MS), [flush])

  useEffect(() => {
    if (retryRef.current && status !== 'conflict' && status !== 'permission') {
      retryRef.current = false
      debounced.schedule()
    }
  }, [status, debounced])

  /** (Re)monta o adaptador conforme o modo e carrega o board. */
  const bootstrap = useCallback(
    async (nextConfig: SyncConfig) => {
      debounced.cancel()
      messagesRef.current = []
      setConflictRemote(null)
      setError(null)
      setNeedsSettings(false)
      setStatus('loading')

      const resolved = await resolveAdapter(nextConfig)
      adapterRef.current = resolved.adapter
      handleRef.current = resolved.handle
      setFileMissing(resolved.needsFile)

      // Arquivo conhecido mas sem autorizacao: mostra a copia local e espera o clique.
      if (resolved.needsPermission) {
        commit(readCachedBoard() ?? createSeedBoard())
        setStatus('permission')
        return
      }

      const adapter = resolved.adapter
      try {
        const loaded = await adapter.load()
        if (loaded) {
          commit(loaded)
          setStatus(adapter.kind === 'local' ? 'local' : 'saved')
          return
        }
        // Nada gravado ainda: leva o board atual (ou o de exemplo) para o destino novo.
        const fallback = readCachedBoard() ?? createSeedBoard()
        commit(fallback)
        if (adapter.kind === 'local') {
          await adapter.save(fallback, 'init')
          setStatus('local')
        } else {
          messagesRef.current = ['feat: cria board inicial']
          await flush()
        }
      } catch (cause) {
        commit(readCachedBoard() ?? createSeedBoard())
        reportError(cause)
      }
    },
    [commit, debounced, flush, reportError],
  )

  useEffect(() => {
    void bootstrap(readConfig())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dispatch = useCallback(
    (action: Action) => {
      const current = boardRef.current
      if (!current) return
      const result = applyAction(current, action)
      if (result.message === '') return
      commit(result.board)

      const adapter = adapterRef.current
      if (!adapter) return
      if (adapter.kind === 'local') {
        void adapter.save(result.board, result.message)
        setStatus('local')
        return
      }
      messagesRef.current.push(result.message)
      if (status !== 'conflict' && status !== 'permission') {
        setStatus('saving')
        debounced.schedule()
      }
    },
    [commit, debounced, status],
  )

  const reload = useCallback(async () => {
    const adapter = adapterRef.current
    if (!adapter || adapter.kind === 'local') return
    if (messagesRef.current.length > 0 || inFlightRef.current) return
    try {
      const remote = await adapter.load()
      if (remote) {
        commit(remote)
        setStatus('saved')
        setError(null)
        setNeedsSettings(false)
      }
    } catch (cause) {
      reportError(cause)
    }
  }, [commit, reportError])

  const saveNow = useCallback(() => {
    debounced.flush()
    if (messagesRef.current.length > 0) void flush()
  }, [debounced, flush])

  const resolveConflict = useCallback(
    (choice: 'remote' | 'local') => {
      const remote = conflictRemote
      setConflictRemote(null)
      if (choice === 'remote' && remote) {
        messagesRef.current = []
        commit(remote)
        setStatus('saved')
        setError(null)
        return
      }
      // Mantem o local: o sha ja foi atualizado pelo load durante o conflito.
      messagesRef.current = [
        'chore: mantém a versão deste dispositivo (conflito resolvido manualmente)',
        ...messagesRef.current,
      ]
      setStatus('saving')
      void flush()
    },
    [commit, conflictRemote, flush],
  )

  const saveConfig = useCallback(
    async (next: SyncConfig) => {
      writeConfig(next)
      setConfig(next)
      await bootstrap(next)
    },
    [bootstrap],
  )

  const grantFilePermission = useCallback(async () => {
    const handle = handleRef.current
    if (!handle) return
    try {
      const state = await requestFilePermission(handle)
      if (state === 'granted') {
        await bootstrap(readConfig())
        return
      }
      setStatus('permission')
      setError('Sem essa autorização o board continua salvo apenas neste navegador.')
    } catch (cause) {
      reportError(cause)
    }
  }, [bootstrap, reportError])

  // Recarrega ao voltar para a aba: cobre edicao em outro aparelho ou no arquivo.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [reload])

  // Avisa se sair da pagina com alteracao ainda nao gravada.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (messagesRef.current.length === 0) return
      debounced.flush()
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [debounced])

  // Volta a tentar quando a rede reaparece.
  useEffect(() => {
    const onOnline = () => {
      if (messagesRef.current.length > 0) debounced.schedule()
      else void reload()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [debounced, reload])

  return {
    board,
    status,
    error,
    needsSettings,
    fileMissing,
    conflictRemote,
    config,
    dispatch,
    reload,
    saveNow,
    resolveConflict,
    saveConfig,
    grantFilePermission,
  }
}
