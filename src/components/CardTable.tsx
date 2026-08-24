import { useMemo, useState } from 'react'
import type { Card } from '../types'
import { SITUATION_LABEL, parseRows, type Row, type Situation } from '../lib/rows'
import { dueState, formatDue, todayISO } from '../lib/dates'

/**
 * A descricao de um card lida como tabela.
 *
 * E uma vista, nao um formato: nada e gravado aqui e a descricao continua sendo
 * a fonte de verdade. O ganho e poder ler por coluna -- quem esta aguardando,
 * quem tem reuniao marcada -- coisa que paragrafo nao permite.
 */

const DOT: Record<Situation, string> = {
  meeting: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  todo: 'bg-sky-500',
  untouched: 'bg-zinc-400 dark:bg-zinc-600',
}

const DUE_TEXT: Record<string, string> = {
  overdue: 'text-red-700 dark:text-red-400 font-semibold',
  today: 'text-amber-700 dark:text-amber-400 font-semibold',
  soon: '',
  later: '',
  none: '',
}

/** Ordem em que as situacoes aparecem quando se ordena por essa coluna. */
const SITUATION_ORDER: Situation[] = ['meeting', 'waiting', 'todo', 'untouched']

type SortKey = 'original' | 'name' | 'situation' | 'when'

export interface CardTableProps {
  card: Card
  onBack: () => void
  onEditDescription: () => void
}

export function CardTable(props: CardTableProps) {
  const [sort, setSort] = useState<SortKey>('original')
  const today = todayISO()
  const year = Number(today.slice(0, 4))

  const { rows, notes } = useMemo(() => parseRows(props.card.description, year), [props.card.description, year])

  const sorted = useMemo(() => {
    const list = [...rows]
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (sort === 'situation')
      list.sort(
        (a, b) =>
          SITUATION_ORDER.indexOf(a.situation) - SITUATION_ORDER.indexOf(b.situation) || a.index - b.index,
      )
    if (sort === 'when')
      // sem data vai para o fim, senao a coluna vazia enterra as reunioes
      list.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.index - b.index)
    return list
  }, [rows, sort])

  const counts = useMemo(() => {
    const out = new Map<Situation, number>()
    for (const row of rows) out.set(row.situation, (out.get(row.situation) ?? 0) + 1)
    return out
  }, [rows])

  const header = (key: SortKey, label: string, className = '') => (
    <th className={`px-2 py-1 text-left font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => setSort((current) => (current === key ? 'original' : key))}
        className={`inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 ${
          sort === key ? 'text-zinc-900 dark:text-zinc-100' : ''
        }`}
        title={sort === key ? 'Clique para voltar à ordem do texto' : `Ordenar por ${label.toLowerCase()}`}
      >
        {label}
        {sort === key && <span aria-hidden="true">↓</span>}
      </button>
    </th>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
        <button type="button" className="btn" onClick={props.onBack}>
          ← Board
        </button>
        <h2 className="truncate text-[13px] font-semibold">{props.card.title}</h2>
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {rows.length} linhas
          {(counts.get('meeting') ?? 0) > 0 && ` · ${counts.get('meeting')} com reunião`}
          {(counts.get('waiting') ?? 0) > 0 && ` · ${counts.get('waiting')} aguardando`}
        </span>
        <button type="button" className="btn ml-auto" onClick={props.onEditDescription}>
          Editar o texto
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <table className="w-full border-collapse text-[12px]">
          <thead className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              {header('name', 'Fornecedor', 'w-40')}
              {header('situation', 'Situação', 'w-44')}
              <th className="px-2 py-1 text-left font-semibold">Detalhe</th>
              <th className="px-2 py-1 text-left font-semibold w-36">Contato</th>
              {header('when', 'Quando', 'w-28')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row: Row) => {
              const due = dueState(row.date)
              return (
                <tr
                  key={`${row.index}-${row.name}`}
                  className="border-b border-zinc-200 align-top hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                >
                  <td className="px-2 py-1.5 font-medium">{row.name}</td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[row.situation]}`} aria-hidden="true" />
                      {SITUATION_LABEL[row.situation]}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400">{row.detail || '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {row.contact || '—'}
                  </td>
                  <td className={`px-2 py-1.5 whitespace-nowrap tabular-nums ${DUE_TEXT[due]}`}>
                    {row.date ? `${formatDue(row.date)}${row.time ? ` ${row.time}` : ''}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {notes.length > 0 && (
          <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Linhas que não são fornecedor
            </p>
            <ul className="space-y-0.5 text-[12px] text-zinc-600 dark:text-zinc-400">
              {notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          Esta tabela é só uma forma de ler a descrição do card — nada aqui é gravado separado. Para mudar qualquer
          linha, edite o texto.
        </p>
      </div>
    </div>
  )
}
