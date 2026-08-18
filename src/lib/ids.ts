export function newId(prefix: string): string {
  const rand = crypto.getRandomValues(new Uint32Array(2))
  return `${prefix}_${rand[0].toString(36)}${rand[1].toString(36)}`
}
