import type { SyncStatus } from '../state/useBoard'

const STYLE: Record<SyncStatus, { label: string; dot: string; box: string; title: string }> = {
  loading: {
    label: 'carregando',
    dot: 'bg-zinc-400 animate-pulse',
    box: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
    title: 'Lendo o board...',
  },
  local: {
    label: 'só neste aparelho',
    dot: 'bg-zinc-400',
    box: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
    title: 'Sem token configurado: os dados ficam apenas neste navegador. Abra Configurações para sincronizar.',
  },
  saved: {
    label: 'salvo',
    dot: 'bg-emerald-500',
    box: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400',
    title: 'Tudo enviado para o GitHub. Clique para buscar alterações de outro aparelho.',
  },
  saving: {
    label: 'salvando',
    dot: 'bg-sky-500 animate-pulse',
    box: 'border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400',
    title: 'Alterações agrupadas por 2s antes de virar um commit. Clique para enviar agora.',
  },
  offline: {
    label: 'offline',
    dot: 'bg-amber-500',
    box: 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-400',
    title: 'Sem conexão. As alterações estão salvas neste aparelho e sobem quando a rede voltar.',
  },
  error: {
    label: 'erro',
    dot: 'bg-red-500',
    box: 'border-red-400 text-red-700 dark:border-red-800 dark:text-red-400',
    title: 'Falha ao salvar. Veja o aviso no topo da tela.',
  },
  permission: {
    label: 'autorizar',
    dot: 'bg-amber-500 animate-pulse',
    box: 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-400',
    title: 'O navegador precisa da sua autorizacao para gravar no arquivo. Clique na faixa no topo da tela.',
  },
  conflict: {
    label: 'conflito',
    dot: 'bg-red-500 animate-pulse',
    box: 'border-red-400 text-red-700 dark:border-red-800 dark:text-red-400',
    title: 'Editado em outro aparelho. Escolha qual versão manter.',
  },
}

export function SyncBadge({ status, onClick }: { status: SyncStatus; onClick: () => void }) {
  const style = STYLE[status]
  return (
    <button
      type="button"
      onClick={onClick}
      title={style.title}
      className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-1 text-[11px] font-medium ${style.box}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </button>
  )
}
