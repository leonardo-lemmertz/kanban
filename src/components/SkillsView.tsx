import { useMemo, useState } from 'react'
import type { Board, Card, Skill } from '../types'
import { PRIORITY_EDGE } from '../lib/priority'
import { dueState, formatDue } from '../lib/dates'

export interface SkillsViewProps {
  board: Board
  onOpenCard: (card: Card) => void
}

interface SkillRow {
  skill: Skill
  open: Card[]
  done: number
}

/**
 * Catalogo das skills do sistema e o que esta andando em cada uma. Os cards
 * "abertos" sao os que nao estao numa coluna marcada como concluida -- a mesma
 * regra da Matriz.
 */
export function SkillsView({ board, onOpenCard }: SkillsViewProps) {
  const [company, setCompany] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const doneColumns = useMemo(() => new Set(board.columns.filter((c) => c.done).map((c) => c.id)), [board.columns])
  const columnTitle = useMemo(() => new Map(board.columns.map((c) => [c.id, c.title])), [board.columns])

  const companies = useMemo(() => {
    const set = new Set<string>()
    for (const skill of board.skills) if (skill.company) set.add(skill.company)
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [board.skills])

  const groups = useMemo(() => {
    const byGroup = new Map<string, SkillRow[]>()
    for (const skill of board.skills) {
      // filtro por empresa mantem os metodos (sem empresa), que valem para todas
      if (company !== '' && skill.company !== undefined && skill.company !== company) continue
      const linked = board.cards.filter((card) => card.skill === skill.id)
      const row: SkillRow = {
        skill,
        open: linked.filter((card) => !doneColumns.has(card.columnId)).sort((a, b) => a.order - b.order),
        done: linked.filter((card) => doneColumns.has(card.columnId)).length,
      }
      const list = byGroup.get(skill.group) ?? []
      list.push(row)
      byGroup.set(skill.group, list)
    }
    return [...byGroup.entries()]
  }, [board.skills, board.cards, company, doneColumns])

  const knownIds = useMemo(() => new Set(board.skills.map((s) => s.id)), [board.skills])
  const openCards = board.cards.filter((c) => !doneColumns.has(c.columnId))
  const linkedOpen = openCards.filter((c) => c.skill !== undefined && knownIds.has(c.skill)).length
  const orphan = board.cards.filter((c) => c.skill !== undefined && !knownIds.has(c.skill))

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (board.skills.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-3">
        <p className="rounded border border-dashed border-zinc-300 px-3 py-6 text-center text-[12px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nenhuma skill no catálogo. A lista vem do campo <code>skills</code> do board.json, mantido pelo sistema.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Skills</h2>
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {board.skills.length} skills · {linkedOpen} de {openCards.length} cards abertos ligados
        </span>
        <select
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          aria-label="Filtrar por empresa"
          className="field ml-auto w-auto py-1"
        >
          <option value="">todas as empresas</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {orphan.length > 0 && (
        <p className="mb-3 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {orphan.length} card(s) ligado(s) a skill que não está mais no catálogo:{' '}
          {[...new Set(orphan.map((c) => `/${c.skill}`))].join(', ')}
        </p>
      )}

      <div className="space-y-4">
        {groups.map(([group, rows]) => (
          <section key={group}>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {group}
            </h3>
            <ul className="space-y-1.5">
              {rows.map(({ skill, open, done }) => {
                const isOpen = expanded.has(skill.id)
                return (
                  <li
                    key={skill.id}
                    className="rounded border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left"
                      onClick={() => toggle(skill.id)}
                      aria-expanded={isOpen}
                      disabled={open.length === 0}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[12px] font-semibold">/{skill.id}</span>
                          {skill.company ? (
                            <span className="rounded-sm bg-sky-50 px-1 text-[10px] leading-4 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                              {skill.company}
                            </span>
                          ) : (
                            <span className="rounded-sm bg-zinc-100 px-1 text-[10px] leading-4 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              método
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug text-zinc-700 dark:text-zinc-300">{skill.summary}</p>
                        {skill.example && (
                          <p className="mt-0.5 text-[11px] italic text-zinc-500 dark:text-zinc-400">“{skill.example}”</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={[
                            'inline-block min-w-6 rounded-sm px-1 text-center text-[11px] font-semibold tabular-nums leading-5',
                            open.length > 0
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                              : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
                          ].join(' ')}
                          title="Cards abertos ligados a esta skill"
                        >
                          {open.length}
                        </span>
                        {done > 0 && (
                          <div className="mt-0.5 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                            {done} concluído{done > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </button>

                    {isOpen && open.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                        {open.map((card) => {
                          const due = dueState(card.dueDate)
                          return (
                            <li key={card.id}>
                              <button
                                type="button"
                                onClick={() => onOpenCard(card)}
                                className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                              >
                                <span className={`h-3 w-1 shrink-0 rounded-sm ${PRIORITY_EDGE[card.priority]}`} aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate text-[12px]">{card.title}</span>
                                {card.dueDate && (
                                  <span
                                    className={`text-[10px] tabular-nums ${
                                      due === 'overdue'
                                        ? 'text-red-600 dark:text-red-400'
                                        : due === 'today'
                                          ? 'text-amber-700 dark:text-amber-400'
                                          : 'text-zinc-400'
                                    }`}
                                  >
                                    {formatDue(card.dueDate)}
                                  </span>
                                )}
                                <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                                  {columnTitle.get(card.columnId)}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
