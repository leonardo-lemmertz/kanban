import type { Board } from '../types'
import { formatDateTime } from '../lib/dates'

export function ErrorBanner(props: {
  message: string
  needsSettings: boolean
  onOpenSettings: () => void
  onRetry: () => void
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 border-b border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-900 dark:bg-red-950/70 dark:text-red-200"
    >
      <span className="flex-1 min-w-[16rem]">{props.message}</span>
      {props.needsSettings && (
        <button type="button" className="btn border-red-300 dark:border-red-800" onClick={props.onOpenSettings}>
          Abrir Configurações
        </button>
      )}
      <button type="button" className="btn border-red-300 dark:border-red-800" onClick={props.onRetry}>
        Tentar de novo
      </button>
      <button
        type="button"
        className="rounded px-1.5 py-1 text-[11px] hover:bg-red-100 dark:hover:bg-red-900"
        onClick={props.onDismiss}
        aria-label="Fechar aviso"
      >
        fechar
      </button>
    </div>
  )
}

/** Modo pasta: o navegador quer a autorizacao de escrita de novo nesta sessao. */
export function PermissionBanner(props: { onGrant: () => void; onOpenSettings: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 border-b border-amber-400 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100"
    >
      <span className="min-w-[16rem] flex-1">
        <span className="font-semibold">Autorize a gravação no arquivo.</span> Por segurança, o navegador pede sua
        confirmação para voltar a escrever no arquivo do board. Até você autorizar, as alterações ficam salvas apenas
        neste navegador.
      </span>
      <button type="button" className="btn btn-primary" onClick={props.onGrant}>
        Autorizar
      </button>
      <button type="button" className="btn border-amber-400 dark:border-amber-700" onClick={props.onOpenSettings}>
        Configurações
      </button>
    </div>
  )
}

/** Modo pasta escolhido, mas nenhum arquivo selecionado (ou o arquivo se perdeu). */
export function FileMissingBanner(props: { onOpenSettings: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 border-b border-amber-400 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100"
    >
      <span className="min-w-[16rem] flex-1">
        O modo <span className="font-semibold">arquivo no computador</span> está escolhido, mas nenhum arquivo foi
        selecionado neste navegador. Enquanto isso, o board fica salvo apenas aqui.
      </span>
      <button type="button" className="btn btn-primary" onClick={props.onOpenSettings}>
        Escolher o arquivo
      </button>
    </div>
  )
}

export function ConflictBanner(props: {
  local: Board
  remote: Board
  onKeepRemote: () => void
  onKeepLocal: () => void
}) {
  const count = (board: Board) => `${board.cards.length} card(s), ${board.archived.length} arquivado(s)`
  return (
    <div
      role="alert"
      className="border-b border-amber-400 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100"
    >
      <p className="font-semibold">Este board foi editado em outro aparelho.</p>
      <p className="mt-0.5">
        Nada foi sobrescrito. Escolha qual versão manter — a outra continua no histórico de commits do repositório de
        dados.
      </p>
      <div className="mt-2 flex flex-wrap items-stretch gap-2">
        <div className="rounded border border-amber-300 bg-white/70 px-2 py-1.5 dark:border-amber-800 dark:bg-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide">No GitHub</p>
          <p className="tabular-nums">{count(props.remote)}</p>
          <p className="text-[11px] tabular-nums opacity-80">{formatDateTime(props.remote.updatedAt)}</p>
          <button type="button" className="btn mt-1.5 border-amber-400 dark:border-amber-700" onClick={props.onKeepRemote}>
            Usar esta e descartar as minhas
          </button>
        </div>
        <div className="rounded border border-amber-300 bg-white/70 px-2 py-1.5 dark:border-amber-800 dark:bg-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide">Neste aparelho</p>
          <p className="tabular-nums">{count(props.local)}</p>
          <p className="text-[11px] tabular-nums opacity-80">{formatDateTime(props.local.updatedAt)}</p>
          <button type="button" className="btn mt-1.5 border-amber-400 dark:border-amber-700" onClick={props.onKeepLocal}>
            Manter as minhas e enviar
          </button>
        </div>
      </div>
    </div>
  )
}
