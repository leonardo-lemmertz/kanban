/** Versao do schema gravado em disco. Incrementar ao mudar o formato e
 *  adicionar o passo correspondente em storage/migrate.ts. */
export const SCHEMA_VERSION = 4

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
  /**
   * Coluna de trabalho terminado. Marcada a mao no menu da coluna, nao deduzida
   * do titulo nem da posicao: os titulos sao livres e as colunas se reordenam.
   * O que cai aqui sai da Matriz -- concluido nao se triem.
   */
  done?: boolean
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
  /** id da skill do sistema ligada a este card (Board.skills); ausente = nenhuma */
  skill?: string
  /** preenchido apenas em Board.archived */
  archivedAt?: string
}

/**
 * Skill do sistema de trabalho (o OS no Claude Code). O catalogo mora no
 * board.json, nao no codigo: este repositorio e publico e as descricoes falam de
 * empresas e caminhos internos. Quem mantem a lista e o proprio sistema, editando
 * o board.json; o app so le e liga cards a ela.
 */
export interface Skill {
  /** o nome do comando, sem a barra: "conciliacao-credeal" */
  id: string
  /** agrupamento na aba Skills: "Conciliação", "Fluxo de caixa"... */
  group: string
  /** empresa a que a skill se refere; ausente = vale para todas (metodo) */
  company?: string
  summary: string
  /** exemplo de como pedir */
  example?: string
}

export interface Board {
  version: number
  columns: Column[]
  cards: Card[]
  archived: Card[]
  /** v4: catalogo de skills; vazio em boards antigos */
  skills: Skill[]
  updatedAt: string
}
