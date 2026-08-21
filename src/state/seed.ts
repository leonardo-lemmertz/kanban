import { SCHEMA_VERSION, type Board } from '../types'
import { todayISO } from '../lib/dates'

function shiftDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

export const DEFAULT_COLUMNS = [
  { id: 'col_backlog', title: 'Backlog' },
  { id: 'col_andamento', title: 'Em andamento', wipLimit: 3 },
  { id: 'col_terceiros', title: 'Aguardando terceiros' },
  { id: 'col_concluido', title: 'Concluído' },
]

/** Board inicial com cards de exemplo, para a tela nao abrir vazia. */
export function createSeedBoard(): Board {
  const now = new Date().toISOString()
  const base = {
    description: '',
    tags: [] as string[],
    checklist: [],
    createdAt: now,
    updatedAt: now,
  }
  return {
    version: SCHEMA_VERSION,
    columns: DEFAULT_COLUMNS.map((c) => ({ ...c })),
    cards: [
      {
        ...base,
        id: 'card_exemplo_1',
        columnId: 'col_andamento',
        title: 'Revisar contrato do fornecedor',
        description:
          'Conferir **cláusula de rescisão** e o prazo de pagamento.\n\n- comparar com a versão anterior\n- validar com o jurídico\n- devolver com comentários',
        priority: 'alta' as const,
        tags: ['contrato', 'jurídico'],
        dueDate: todayISO(),
        order: 100,
      },
      {
        ...base,
        id: 'card_exemplo_2',
        columnId: 'col_terceiros',
        title: 'Aguardando retorno da contabilidade',
        description: 'Enviado em anexo o fechamento do mês. Cobrar se não responderem até sexta.',
        priority: 'media' as const,
        tags: ['financeiro'],
        dueDate: shiftDays(-2),
        order: 100,
      },
      {
        ...base,
        id: 'card_exemplo_3',
        columnId: 'col_backlog',
        title: 'Montar relatório trimestral',
        description: 'Consolidar números do trimestre e escrever o resumo executivo.',
        priority: 'urgente' as const,
        tags: ['relatório', 'diretoria'],
        dueDate: shiftDays(5),
        order: 100,
      },
      {
        ...base,
        id: 'card_exemplo_4',
        columnId: 'col_backlog',
        title: 'Organizar pasta de documentos',
        description: 'Sem pressa. Padronizar nomes dos arquivos por ano.',
        priority: 'baixa' as const,
        tags: ['organização'],
        order: 200,
      },
    ],
    archived: [],
    updatedAt: now,
  }
}
