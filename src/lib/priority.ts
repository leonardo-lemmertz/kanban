import type { Priority } from '../types'

/** Cores sobrias, so o suficiente para diferenciar de relance. */
export const PRIORITY_PILL: Record<Priority, string> = {
  baixa: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400',
  media: 'border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400',
  alta: 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-400',
  urgente: 'border-red-400 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400',
}

/** Faixa lateral do card. */
export const PRIORITY_EDGE: Record<Priority, string> = {
  baixa: 'bg-zinc-300 dark:bg-zinc-700',
  media: 'bg-sky-400 dark:bg-sky-600',
  alta: 'bg-amber-400 dark:bg-amber-500',
  urgente: 'bg-red-500',
}
