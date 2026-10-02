import { useEffect, useRef, useState } from 'react'
import { PRIORITIES, PRIORITY_LABEL, type Card, type Column, type Priority, type Skill } from '../types'
import type { CardPatch, NewCardInput } from '../state/boardReducer'
import { Markdown } from '../lib/markdown'
import { looksLikeTable } from '../lib/rows'
import { formatDateTime } from '../lib/dates'
import { PRIORITY_PILL } from '../lib/priority'

export interface CardPanelProps {
  mode: 'create' | 'edit'
  card: Card | null
  columnId: string
  columns: Column[]
  skills: Skill[]
  onClose: () => void
  onCreate: (input: NewCardInput) => void
  onUpdate: (patch: CardPatch) => void
  onArchive: () => void
  onDelete: () => void
  onMove: (columnId: string) => void
  onOpenAsTable: () => void
}

interface Draft {
  title: string
  description: string
  priority: Priority
  tags: string
  dueDate: string
  skill: string
}

function toDraft(card: Card | null): Draft {
  return {
    title: card?.title ?? '',
    description: card?.description ?? '',
    priority: card?.priority ?? 'media',
    tags: card?.tags.join(', ') ?? '',
    dueDate: card?.dueDate ?? '',
    skill: card?.skill ?? '',
  }
}

function parseTags(raw: string): string[] {
  const seen = new Set<string>()
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '' && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
}

export function CardPanel(props: CardPanelProps) {
  const { mode, card } = props
  const [draft, setDraft] = useState<Draft>(() => toDraft(card))
  const [preview, setPreview] = useState(true)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // troca de card selecionado recarrega o rascunho
  useEffect(() => {
    setDraft(toDraft(card))
    setPreview(true)
  }, [card?.id, mode])

  useEffect(() => {
    titleRef.current?.focus()
    if (mode === 'create') titleRef.current?.select()
  }, [mode])

  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  /** No modo edicao gravamos campo a campo ao sair do campo. */
  const commit = (field: keyof Draft) => {
    if (mode !== 'edit' || !card) return
    switch (field) {
      case 'title': {
        const title = draft.title.trim()
        if (title !== '' && title !== card.title) props.onUpdate({ title })
        else if (title === '') setDraft((d) => ({ ...d, title: card.title }))
        break
      }
      case 'description':
        if (draft.description !== card.description) props.onUpdate({ description: draft.description })
        break
      case 'tags': {
        const tags = parseTags(draft.tags)
        if (tags.join('\0') !== card.tags.join('\0')) props.onUpdate({ tags })
        break
      }
      case 'dueDate':
        if (draft.dueDate !== (card.dueDate ?? '')) props.onUpdate({ dueDate: draft.dueDate })
        break
      case 'priority':
      case 'skill':
        break
    }
  }

  const create = () => {
    if (draft.title.trim() === '') return
    props.onCreate({
      columnId: props.columnId,
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      tags: parseTags(draft.tags),
      ...(draft.dueDate !== '' ? { dueDate: draft.dueDate } : {}),
      ...(draft.skill !== '' ? { skill: draft.skill } : {}),
    })
  }

  const currentColumn = props.columns.find((c) => c.id === (card?.columnId ?? props.columnId))

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-zinc-300 bg-white shadow-xl sm:w-[24rem] dark:border-zinc-700 dark:bg-zinc-900"
      aria-label={mode === 'create' ? 'Novo card' : 'Detalhe do card'}
    >
      <header className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 className="flex-1 text-[12px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {mode === 'create' ? 'Novo card' : 'Card'}
        </h2>
        {mode === 'edit' && (
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">salvo automaticamente</span>
        )}
        <button type="button" className="btn" onClick={props.onClose} aria-label="Fechar painel (Esc)">
          Esc
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <div>
          <label className="label" htmlFor="card-title">
            Título
          </label>
          <textarea
            id="card-title"
            ref={titleRef}
            rows={2}
            value={draft.title}
            onChange={(event) => patch('title', event.target.value)}
            onBlur={() => commit('title')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (mode === 'create') create()
                else event.currentTarget.blur()
              }
            }}
            placeholder="O que precisa ser feito?"
            className="field resize-none font-medium"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="card-priority">
              Prioridade
            </label>
            <select
              id="card-priority"
              value={draft.priority}
              onChange={(event) => {
                const priority = event.target.value as Priority
                patch('priority', priority)
                if (mode === 'edit' && card && priority !== card.priority) props.onUpdate({ priority })
              }}
              className="field"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="card-due">
              Entrega
            </label>
            <input
              id="card-due"
              type="date"
              value={draft.dueDate}
              onChange={(event) => patch('dueDate', event.target.value)}
              onBlur={() => commit('dueDate')}
              className="field"
            />
          </div>
        </div>

        {(props.skills.length > 0 || draft.skill !== '') && (
          <div>
            <label className="label" htmlFor="card-skill">
              Skill
            </label>
            <select
              id="card-skill"
              value={draft.skill}
              onChange={(event) => {
                const skill = event.target.value
                patch('skill', skill)
                if (mode === 'edit' && card && skill !== (card.skill ?? '')) props.onUpdate({ skill })
              }}
              className="field"
            >
              <option value="">— nenhuma —</option>
              {/* skill que saiu do catalogo continua visivel ate o card ser religado */}
              {draft.skill !== '' && !props.skills.some((s) => s.id === draft.skill) && (
                <option value={draft.skill}>/{draft.skill} (fora do catálogo)</option>
              )}
              {[...new Set(props.skills.map((s) => s.group))].map((group) => (
                <optgroup key={group} label={group}>
                  {props.skills
                    .filter((s) => s.group === group)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        /{s.id}
                        {s.company ? ` · ${s.company}` : ''}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="card-tags">
            Tags (separadas por vírgula)
          </label>
          <input
            id="card-tags"
            value={draft.tags}
            onChange={(event) => patch('tags', event.target.value)}
            onBlur={() => commit('tags')}
            placeholder="contrato, jurídico"
            className="field"
          />
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label className="label mb-0" htmlFor="card-description">
              Descrição
            </label>
            <button
              type="button"
              className="text-[11px] text-sky-700 hover:underline dark:text-sky-400"
              onClick={() => {
                if (preview) setPreview(false)
                else {
                  commit('description')
                  setPreview(true)
                }
              }}
            >
              {preview ? 'editar' : 'ver formatado'}
            </button>
          </div>

          {preview && draft.description.trim() !== '' ? (
            <div
              className="min-h-[6rem] cursor-text rounded border border-transparent px-2 py-1.5 hover:border-zinc-200 dark:hover:border-zinc-800"
              onClick={() => setPreview(false)}
              title="Clique para editar"
            >
              <Markdown source={draft.description} />
            </div>
          ) : (
            <textarea
              id="card-description"
              rows={8}
              value={draft.description}
              onChange={(event) => patch('description', event.target.value)}
              onBlur={() => {
                commit('description')
                if (draft.description.trim() !== '') setPreview(true)
              }}
              placeholder={'Aceita markdown básico:\n**negrito**, *itálico*, - listas, [link](https://…)'}
              className="field resize-y font-mono text-[12px]"
            />
          )}
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            **negrito** · *itálico* · `código` · - lista · [texto](url)
          </p>

          {/* aparece so quando a descricao tem varias linhas "nome: detalhe" */}
          {mode === 'edit' && looksLikeTable(draft.description, new Date().getFullYear()) && (
            <button type="button" className="btn mt-1.5 w-full justify-center" onClick={props.onOpenAsTable}>
              Ver como tabela
            </button>
          )}
        </div>

        {mode === 'edit' && card && (
          <div className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div>
              <label className="label" htmlFor="card-column">
                Coluna
              </label>
              <select
                id="card-column"
                value={card.columnId}
                onChange={(event) => props.onMove(event.target.value)}
                className="field"
              >
                {props.columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <dt>Criado</dt>
              <dd className="tabular-nums">{formatDateTime(card.createdAt)}</dd>
              <dt>Atualizado</dt>
              <dd className="tabular-nums">{formatDateTime(card.updatedAt)}</dd>
            </dl>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        {mode === 'create' ? (
          <>
            <button type="button" className="btn btn-primary" onClick={create} disabled={draft.title.trim() === ''}>
              Criar em {currentColumn?.title ?? 'coluna'}
            </button>
            <button type="button" className="btn" onClick={props.onClose}>
              Cancelar
            </button>
            <span className={`ml-auto rounded-sm border px-1 text-[10px] font-semibold uppercase ${PRIORITY_PILL[draft.priority]}`}>
              {PRIORITY_LABEL[draft.priority]}
            </span>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={props.onArchive}>
              Arquivar
            </button>
            <button
              type="button"
              className="btn btn-danger ml-auto"
              onClick={() => {
                if (window.confirm('Excluir este card definitivamente? Prefira arquivar.')) props.onDelete()
              }}
            >
              Excluir
            </button>
          </>
        )}
      </footer>
    </aside>
  )
}
