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

/**
 * Quadrante da matriz de Eisenhower. Atribuido a mao na aba Matriz, nao
 * derivado da prioridade: com um eixo so nao da para extrair dois, e na pratica
 * a maioria dos cards fica na prioridade padrao, o que jogaria quase tudo num
 * quadrante so.
 */
export type Quadrant = 1 | 2 | 3 | 4

export const QUADRANTS: Quadrant[] = [1, 2, 3, 4]

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  1: 'Faça agora',
  2: 'Agende',
  3: 'Delegue',
  4: 'Elimine',
}

/** Linha (importante) e coluna (urgente) de cada quadrante, para montar a grade. */
export const QUADRANT_AXES: Record<Quadrant, { important: boolean; urgent: boolean }> = {
  1: { important: true, urgent: true },
  2: { important: true, urgent: false },
  3: { important: false, urgent: true },
  4: { important: false, urgent: false },
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
  /** quadrante da matriz de Eisenhower; ausente = ainda nao classificado */
  quadrant?: Quadrant
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
