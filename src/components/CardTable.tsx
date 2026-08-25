import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../types'
import {
  SITUATIONS,
  SITUATION_LABEL,
  addRow,
  parseRows,
  removeRow,
  setRowDetail,
  setRowName,
  setRowSituation,
  type Row,
  type Situation,
} from '../lib/rows'
import { dueState, formatDue, todayISO } from '../lib/dates'

/**
 * A descricao de um card lida -- e editada -- como tabela.
 *
 * Cada celula grava de volta na propria descricao: nao existe campo novo, nao
 * existe dado duplicado. O ganho e poder ler e mexer por coluna (quem esta
 * aguardando, quem tem reuniao marcada), coisa que paragrafo nao permite.
 */

const DOT: Record<Situation, string> = {
  meeting: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  todo: 'bg-sky-500',
  untouched: 'bg-zinc-400 dark:bg-zinc-600',
  discarded: 'bg-zinc-300 ring-1 ring-zinc-400 dark:bg-zinc-800 dark:ring-zinc-600',
}

const DUE_TEXT: Record<string, string> = {
  overdue: 'text-red-700 dark:text-red-400 font-semibold',
  today: 'text-amber-700 dark:text-amber-400 font-semibold',
  soon: '',
  later: '',
  none: '',
}

type SortKey = 'original' | 'name' | 'situation' | 'when'

/** Celula de texto: guarda um rascunho e so grava ao sair do campo ou no Enter. */
function TextCell(props: {
  value: string
  placeholder?: string
  autoFocus?: boolean
  className?: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(props.value)
  const ref = useRef<HTMLInputElement>(null)
  /** ultimo texto ja gravado, para o Enter seguido de blur nao gravar duas vezes */
  const saved = useRef(props.value)

  // o texto pode mudar por fora (editar a descricao, desfazer): reacompanha
  useEffect(() => {
    setDraft(props.value)
    saved.current = props.value
  }, [props.value])

  const commit = (value: string) => {
    if (value === saved.current) return
    saved.current = value
    props.onCommit(value)
  }

  useEffect(() => {
    if (props.autoFocus) {
      ref.current?.focus()
      ref.current?.select()
    }
  }, [props.autoFocus])

  return (
    <input
      ref={ref}
      value={draft}
      placeholder={props.placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          // grava aqui mesmo: nem todo navegador dispara o blur do jeito esperado
          event.preventDefault()
          commit(draft)
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          // sem isso o Esc fecharia a tabela inteira e o rascunho se perderia
          event.stopPropagation()
          setDraft(props.value)
          saved.current = props.value
          event.currentTarget.blur()
        }
      }}
      className={`w-full rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-zinc-300
        focus:border-sky-600 focus:bg-white focus:outline-none dark:hover:border-zinc-700
        dark:focus:border-sky-400 dark:focus:bg-zinc-900 ${props.className ?? ''}`}
    />
  )
}

export interface CardTableProps {
  card: Card
  onBack: () => void
  onEditDescription: () => void
  onChangeDescription: (description: string) => void
}

export function CardTable(props: CardTableProps) {
  const [sort, setSort] = useState<SortKey>('original')
  /** linha recem-criada, para o cursor ja cair no nome dela */
  const [focusLine, setFocusLine] = useState<number | null>(null)
  const today = todayISO()
  const year = Number(today.slice(0, 4))

  const description = props.card.description
  const { rows, notes } = useMemo(() => parseRows(description, year), [description, year])

  const sorted = useMemo(() => {
    const list = [...rows]
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (sort === 'situation')
      list.sort(
        (a, b) => SITUATIONS.indexOf(a.situation) - SITUATIONS.indexOf(b.situation) || a.index - b.index,
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
              {header('name', 'Fornecedor', 'w-44')}
              {header('situation', 'Situação', 'w-44')}
              <th className="px-2 py-1 text-left font-semibold">Detalhe</th>
              <th className="w-32 px-2 py-1 text-left font-semibold">Contato</th>
              {header('when', 'Quando', 'w-28')}
              <th className="w-8 px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row: Row) => {
              const due = dueState(row.date)
              return (
                <tr
                  key={row.line}
                  className={`group border-b border-zinc-200 align-middle hover:bg-zinc-50 dark:border-zinc-800
                    dark:hover:bg-zinc-900/60 ${row.situation === 'discarded' ? 'opacity-50' : ''}`}
                >
                  <td className="px-1 py-0.5">
                    <TextCell
                      value={row.name}
                      autoFocus={row.line === focusLine}
                      className="font-medium"
                      onCommit={(value) => props.onChangeDescription(setRowName(description, row.line, value))}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <span className="inline-flex w-full items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[row.situation]}`} aria-hidden="true" />
                      <select
                        value={row.situation}
                        onChange={(event) =>
                          props.onChangeDescription(
                            setRowSituation(description, row.line, event.target.value as Situation),
                          )
                        }
                        title={
                          row.explicit
                            ? 'Situação marcada à mão — aparece no texto como [marcador]'
                            : 'Situação deduzida do texto'
                        }
                        className="w-full cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5
                          hover:border-zinc-300 focus:border-sky-600 focus:outline-none dark:hover:border-zinc-700
                          dark:focus:border-sky-400"
                      >
                        {SITUATIONS.map((situation) => (
                          <option key={situation} value={situation}>
                            {SITUATION_LABEL[situation]}
                          </option>
                        ))}
                      </select>
                    </span>
                  </td>
                  <td className="px-1 py-0.5">
                    <TextCell
                      value={row.detail}
                      placeholder="—"
                      className="text-zinc-600 dark:text-zinc-400"
                      onCommit={(value) => props.onChangeDescription(setRowDetail(description, row.line, value))}
                    />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {row.contact || '—'}
                  </td>
                  <td className={`px-2 py-1.5 whitespace-nowrap tabular-nums ${DUE_TEXT[due]}`}>
                    {row.date ? `${formatDue(row.date)}${row.time ? ` ${row.time}` : ''}` : '—'}
                  </td>
                  <td className="px-1 py-0.5 text-right">
                    <button
                      type="button"
                      title="Apagar esta linha"
                      className="rounded px-1 text-zinc-400 opacity-0 hover:bg-red-50 hover:text-red-700
                        focus:opacity-100 group-hover:opacity-100 dark:hover:bg-red-950 dark:hover:text-red-400"
                      onClick={() => {
                        const ok = window.confirm(`Apagar a linha "${row.name}"?`)
                        if (ok) props.onChangeDescription(removeRow(description, row.line))
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <button
          type="button"
          className="btn mt-2"
          onClick={() => {
            const next = addRow(description, 'Novo')
            setFocusLine(next.line)
            props.onChangeDescription(next.description)
          }}
        >
          + Linha
        </button>

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
          Clique em qualquer célula para editar — o que você escreve aqui é gravado na descrição do card. As colunas
          Contato e Quando saem do próprio detalhe (escreva por exemplo <span className="tabular-nums">25/08 14h</span>).
        </p>
      </div>
    </div>
  )
}
