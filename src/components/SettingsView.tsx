import { useEffect, useState } from 'react'
import {
  DEFAULT_CONFIG,
  forgetFile,
  isFileModeSupported,
  isGithubConfigured,
  loadFileHandle,
  pickExistingFile,
  pickFileToSave,
  testConnection,
  type StorageMode,
  type SyncConfig,
} from '../storage'

export interface SettingsViewProps {
  config: SyncConfig
  onSave: (config: SyncConfig) => Promise<void>
  onExport: () => void
}

const MODES: { value: StorageMode; title: string; detail: string }[] = [
  {
    value: 'local',
    title: 'Só neste navegador',
    detail: 'Nada a configurar. Os cards ficam guardados neste navegador, neste computador.',
  },
  {
    value: 'file',
    title: 'Arquivo no computador',
    detail:
      'Grava num arquivo que você escolhe, a cada alteração. Sem token. Se apontar para uma pasta de rede, os dados sobrevivem à troca de máquina.',
  },
  {
    value: 'github',
    title: 'GitHub (pela internet)',
    detail: 'Sincroniza entre aparelhos, inclusive celular e fora da empresa. Exige um token.',
  },
]

export function SettingsView(props: SettingsViewProps) {
  const [draft, setDraft] = useState<SyncConfig>(props.config)
  const [fileName, setFileName] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const fileSupported = isFileModeSupported()

  useEffect(() => {
    void loadFileHandle().then((handle) => setFileName(handle?.name ?? null))
  }, [])

  const set = <K extends keyof SyncConfig>(key: K, value: SyncConfig[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const pick = async (kind: 'new' | 'existing') => {
    setResult(null)
    try {
      const handle = kind === 'new' ? await pickFileToSave() : await pickExistingFile()
      if (!handle) return
      setFileName(handle.name)
      const next: SyncConfig = { ...draft, mode: 'file' }
      setDraft(next)
      await props.onSave(next)
      setResult({
        ok: true,
        message:
          kind === 'new'
            ? `Pronto. O board passa a ser gravado em ${handle.name} a cada alteração.`
            : `Pronto. O board foi carregado de ${handle.name} e passa a ser gravado ali.`,
      })
    } catch (cause) {
      setResult({ ok: false, message: cause instanceof Error ? cause.message : String(cause) })
    }
  }

  const stopUsingFile = async () => {
    if (!window.confirm('Parar de gravar no arquivo? O board continua salvo neste navegador, e o arquivo fica como está.'))
      return
    await forgetFile()
    setFileName(null)
    const next: SyncConfig = { ...draft, mode: 'local' }
    setDraft(next)
    await props.onSave(next)
    setResult({ ok: true, message: 'O arquivo foi desvinculado. O board agora fica só neste navegador.' })
  }

  const test = async () => {
    setTesting(true)
    setResult(null)
    try {
      setResult({ ok: true, message: await testConnection(draft) })
    } catch (cause) {
      setResult({ ok: false, message: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      setTesting(false)
    }
  }

  const saveGithub = async () => {
    setSaving(true)
    try {
      await props.onSave({ ...draft, mode: 'github' })
      setDraft((d) => ({ ...d, mode: 'github' }))
      setResult({ ok: true, message: 'Configuração salva. O board foi recarregado a partir do GitHub.' })
    } finally {
      setSaving(false)
    }
  }

  const disconnectGithub = async () => {
    if (!window.confirm('Remover o token deste navegador? O board continua salvo aqui, mas para de sincronizar.')) return
    const cleared: SyncConfig = { ...DEFAULT_CONFIG, mode: 'local', owner: draft.owner, repo: draft.repo }
    setDraft(cleared)
    await props.onSave(cleared)
    setResult({ ok: true, message: 'Token removido deste navegador.' })
  }

  const chooseMode = async (mode: StorageMode) => {
    setResult(null)
    // Modo escolhido mas ainda sem o que ele precisa: abre a secao para o usuario
    // completar, sem gravar a configuracao (senao o app cairia no localStorage).
    const incomplete = (mode === 'file' && !fileName) || (mode === 'github' && !isGithubConfigured(draft))
    if (incomplete) {
      setDraft((d) => ({ ...d, mode }))
      return
    }
    const next = { ...draft, mode }
    setDraft(next)
    await props.onSave(next)
  }

  return (
    <div className="mx-auto h-full max-w-2xl space-y-5 overflow-y-auto p-4">
      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Onde salvar o board
        </h2>
        <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400">
          O app funciona nos três modos. A diferença é onde os cards ficam guardados e o que acontece se você trocar de
          computador.
        </p>

        <div className="mt-2 space-y-1.5">
          {MODES.map((mode) => {
            // selecao segue o rascunho; "em uso" marca o que esta realmente ativo
            const active = draft.mode === mode.value
            const inUse = props.config.mode === mode.value
            const blocked = mode.value === 'file' && !fileSupported
            return (
              <button
                key={mode.value}
                type="button"
                disabled={blocked}
                onClick={() => void chooseMode(mode.value)}
                className={[
                  'flex w-full gap-2 rounded border px-2.5 py-2 text-left',
                  active
                    ? 'border-sky-600 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40'
                    : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600',
                  blocked ? 'opacity-50' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-0.5 h-3 w-3 shrink-0 rounded-full border-2',
                    active ? 'border-sky-600 bg-sky-600 dark:border-sky-400 dark:bg-sky-400' : 'border-zinc-400',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">
                    {mode.title}
                    {inUse && <span className="ml-1.5 text-[11px] font-normal text-sky-700 dark:text-sky-400">em uso</span>}
                  </span>
                  <span className="block text-[12px] text-zinc-600 dark:text-zinc-400">{mode.detail}</span>
                  {blocked && (
                    <span className="block text-[11px] text-amber-700 dark:text-amber-400">
                      Este navegador não suporta gravar em arquivo — use o Chrome ou o Edge.
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {(draft.mode === 'file' || props.config.mode === 'file') && fileSupported && (
        <section className="space-y-2 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Arquivo do board
          </h3>

          <p className="text-[12px]">
            {fileName ? (
              <>
                Gravando em <span className="font-mono font-semibold">{fileName}</span>. Por segurança, o navegador não
                revela a pasta completa — é a que você escolheu no seletor.
              </>
            ) : (
              'Nenhum arquivo escolhido ainda. Escolha abaixo; o board atual é gravado nele na hora.'
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void pick('new')}>
              {fileName ? 'Escolher outro arquivo…' : 'Escolher onde salvar…'}
            </button>
            <button type="button" className="btn" onClick={() => void pick('existing')}>
              Abrir um arquivo existente…
            </button>
            {fileName && (
              <button type="button" className="btn btn-danger ml-auto" onClick={() => void stopUsingFile()}>
                Parar de usar o arquivo
              </button>
            )}
          </div>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold">Escolher onde salvar</span> cria (ou substitui) o arquivo com o board que
            está na tela agora. <span className="font-semibold">Abrir um arquivo existente</span> faz o contrário: lê o
            board de um arquivo já gravado, substituindo o que está na tela. Ao reabrir o site, o navegador pode pedir
            uma confirmação para voltar a gravar no arquivo — é um clique na faixa que aparece no topo.
          </p>
        </section>
      )}

      {(draft.mode === 'github' || props.config.mode === 'github') && (
        <section className="space-y-3 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Sincronização por GitHub
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cfg-owner">
                Usuário ou organização
              </label>
              <input
                id="cfg-owner"
                value={draft.owner}
                onChange={(event) => set('owner', event.target.value.trim())}
                placeholder="seu-usuario"
                className="field"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label" htmlFor="cfg-repo">
                Repositório de dados (privado)
              </label>
              <input
                id="cfg-repo"
                value={draft.repo}
                onChange={(event) => set('repo', event.target.value.trim())}
                placeholder="kanban-data"
                className="field"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label" htmlFor="cfg-path">
                Arquivo
              </label>
              <input
                id="cfg-path"
                value={draft.path}
                onChange={(event) => set('path', event.target.value.trim())}
                placeholder="board.json"
                className="field"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label" htmlFor="cfg-branch">
                Branch
              </label>
              <input
                id="cfg-branch"
                value={draft.branch}
                onChange={(event) => set('branch', event.target.value.trim())}
                placeholder="main"
                className="field"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cfg-token">
              Fine-grained personal access token
            </label>
            <input
              id="cfg-token"
              type="password"
              value={draft.token}
              onChange={(event) => set('token', event.target.value.trim())}
              placeholder="github_pat_…"
              className="field font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Escopo mínimo: acesso <span className="font-semibold">somente</span> ao repositório de dados, permissão{' '}
              <span className="font-semibold">Contents: Read and write</span>, com data de expiração. O passo a passo
              está no README do repositório do app.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn" onClick={() => void test()} disabled={testing || !isGithubConfigured(draft)}>
              {testing ? 'Testando…' : 'Testar conexão'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveGithub()}
              disabled={saving || !isGithubConfigured(draft)}
            >
              {saving ? 'Salvando…' : 'Salvar e recarregar'}
            </button>
            {isGithubConfigured(props.config) && (
              <button type="button" className="btn btn-danger ml-auto" onClick={() => void disconnectGithub()}>
                Remover token deste navegador
              </button>
            )}
          </div>

          <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            O token fica no <span className="font-mono">localStorage</span> deste navegador — não vai para nenhum arquivo
            do repositório. Em troca, quem tiver acesso a este navegador alcança o repositório de dados; por isso o
            escopo restrito a um repositório e a data de expiração importam. Em computador compartilhado, use{' '}
            <span className="font-semibold">Remover token deste navegador</span> ao terminar.
          </p>
        </section>
      )}

      {result && (
        <p
          className={[
            'rounded border px-2 py-1.5 text-[12px]',
            result.ok
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
              : 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
          ].join(' ')}
        >
          {result.message}
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Backup manual
        </h3>
        <p className="text-[12px] text-zinc-600 dark:text-zinc-400">
          Funciona em qualquer modo: baixe o JSON quando quiser e reimporte pela barra superior.
        </p>
        <button type="button" className="btn" onClick={props.onExport}>
          Exportar board.json
        </button>
      </section>

      <section>
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Atalhos</h3>
        <dl className="mt-1 grid grid-cols-[3rem_1fr] gap-y-1 text-[12px] text-zinc-600 dark:text-zinc-400">
          <dt className="font-mono font-semibold">N</dt>
          <dd>novo card</dd>
          <dt className="font-mono font-semibold">/</dt>
          <dd>buscar</dd>
          <dt className="font-mono font-semibold">Esc</dt>
          <dd>fechar painel / limpar busca</dd>
        </dl>
      </section>
    </div>
  )
}
