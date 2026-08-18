import { useState } from 'react'
import { DEFAULT_CONFIG, isSyncConfigured, testConnection, type GithubConfig } from '../storage'

export interface SettingsViewProps {
  config: GithubConfig
  onSave: (config: GithubConfig) => Promise<void>
  onExport: () => void
}

export function SettingsView(props: SettingsViewProps) {
  const [draft, setDraft] = useState<GithubConfig>(props.config)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof GithubConfig>(key: K, value: GithubConfig[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

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

  const save = async () => {
    setSaving(true)
    try {
      await props.onSave(draft)
      setResult({ ok: true, message: 'Configuração salva. O board foi recarregado a partir do GitHub.' })
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    if (!window.confirm('Remover o token deste navegador? O board continua salvo aqui, mas para de sincronizar.')) return
    const cleared = { ...DEFAULT_CONFIG, owner: draft.owner, repo: draft.repo }
    setDraft(cleared)
    await props.onSave(cleared)
    setResult({ ok: true, message: 'Token removido deste navegador.' })
  }

  return (
    <div className="mx-auto h-full max-w-2xl space-y-5 overflow-y-auto p-4">
      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Sincronização
        </h2>
        <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400">
          Sem token, o board fica salvo apenas neste navegador. Com token, cada alteração vira um commit no repositório
          privado de dados e o board abre igual em qualquer aparelho.
        </p>
        <p className="mt-1 text-[12px] font-medium">
          Estado atual:{' '}
          {isSyncConfigured(props.config) ? (
            <span className="text-emerald-700 dark:text-emerald-400">
              sincronizando com {props.config.owner}/{props.config.repo}
            </span>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">apenas neste aparelho</span>
          )}
        </p>
      </section>

      <section className="space-y-3 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
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
            <span className="font-semibold">Contents: Read and write</span>, com data de expiração. O passo a passo está
            no README do repositório do app.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={test} disabled={testing || !isSyncConfigured(draft)}>
            {testing ? 'Testando…' : 'Testar conexão'}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar e recarregar'}
          </button>
          {isSyncConfigured(props.config) && (
            <button type="button" className="btn btn-danger ml-auto" onClick={disconnect}>
              Remover token deste navegador
            </button>
          )}
        </div>

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
      </section>

      <section className="rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide">Sobre a segurança do token</h3>
        <p className="mt-1">
          O token é guardado no <span className="font-mono">localStorage</span> deste navegador — não vai para nenhum
          arquivo do repositório do app. Em troca: quem tiver acesso a este navegador (ou conseguir executar script
          nele) alcança o repositório de dados. Por isso o escopo restrito a um único repositório e a data de expiração
          importam de verdade. Em computador compartilhado, use{' '}
          <span className="font-semibold">Remover token deste navegador</span> ao terminar.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Backup manual
        </h3>
        <p className="text-[12px] text-zinc-600 dark:text-zinc-400">
          O plano B independe do token: baixe o JSON quando quiser e reimporte pela barra superior.
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
