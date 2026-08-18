/** Datas de entrega sao dia puro (YYYY-MM-DD), comparadas no fuso local. */
export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

export type DueState = 'none' | 'overdue' | 'today' | 'soon' | 'later'

export function dueState(dueDate?: string): DueState {
  if (!dueDate) return 'none'
  const today = todayISO()
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  const in3 = new Date()
  in3.setDate(in3.getDate() + 3)
  const m = String(in3.getMonth() + 1).padStart(2, '0')
  const limit = `${in3.getFullYear()}-${m}-${String(in3.getDate()).padStart(2, '0')}`
  return dueDate <= limit ? 'soon' : 'later'
}

export function formatDue(dueDate: string): string {
  const [y, m, d] = dueDate.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
