/** Versao do schema gravado em disco. Incrementar ao mudar o formato e
 *  adicionar o passo correspondente em storage/migrate.ts. */
export const SCHEMA_VERSION = 2

export type Priority = 'baixa' | 'media' | 'alta' | 'urgente'

export const PRIORITIES: Priority[] = ['baixa', 'media', 'alta', 'urgente']

export const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

export interface Column {
  id: string
  title: string
  wipLimit?: number
}

/**
 * Estado de um item de checklist.
 *
 * Sao tres e nao dois porque boa parte do trabalho nao e nem pendente nem
 * pronta: esta na mao de outra pessoa. Sem o estado "aguardando" essa situacao
 * some dentro de "a fazer" e nao da para saber de quem se esta esperando o que.
 */
export type ItemState = 'todo' | 'waiting' | 'done'

export const ITEM_STATES: ItemState[] = ['todo', 'waiting', 'done']

export const ITEM_STATE_LABEL: Record<ItemState, string> = {
  todo: 'A fazer',
  waiting: 'Aguardando',
  done: 'Feito',
}

export interface ChecklistItem {
  id: string
  text: string
  state: ItemState
  /** data do item (YYYY-MM-DD), independente do prazo do card */
  dueDate?: string
  /** hora do item (HH:MM), para reuniao marcada */
  time?: string
  /** quando entrou em "aguardando"; e o que permite contar ha quantos dias espera */
  waitingSince?: string
  updatedAt: string
}

export interface Card {
  id: string
  columnId: string
  title: string
  description: string
  priority: Priority
  tags: string[]
  dueDate?: string
  createdAt: string
  updatedAt: string
  order: number
  /** sub-tarefas do card; vazio na maioria dos cards */
  checklist: ChecklistItem[]
  /** preenchido apenas em Board.archived */
  archivedAt?: string
}

export interface Board {
  version: number
  columns: Column[]
  cards: Card[]
  archived: Card[]
  updatedAt: string
}
