/** Versao do schema gravado em disco. Incrementar ao mudar o formato e
 *  adicionar o passo correspondente em storage/migrate.ts. */
export const SCHEMA_VERSION = 1

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
