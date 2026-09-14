// The single source of truth for personnel groups. Task categories are separate.
export const GROUP_CONFIG = [
  { name: '机械组', code: 'MECHANICAL', abbr: 'ME' },
  { name: '电控组', code: 'ELECTRONIC', abbr: 'EC' },
  { name: '视觉组', code: 'VISION', abbr: 'CV' },
  { name: '运营组', code: 'OPERATIONS', abbr: 'OP' },
  { name: '操作手组', code: 'PILOTS', abbr: 'PL' },
] as const
export type Group = typeof GROUP_CONFIG[number]['name']
export const GROUPS: readonly Group[] = GROUP_CONFIG.map(g => g.name)
const aliases = new Map<string, Group>(GROUP_CONFIG.flatMap(g => [[g.name,g.name], [g.name.slice(0,-1),g.name]] as [string,Group][]))
export function normalizeGroup(value: unknown): Group | null {
  const values = Array.isArray(value) ? value : [value]
  const matched = [...new Set(values.flatMap(v => {
    const text = typeof v === 'string' ? v.trim() : v && typeof v === 'object' ? String((v as {name?:string;text?:string}).name || (v as {text?:string}).text || '') : ''
    const group = aliases.get(text)
    return group ? [group] : []
  }))]
  return matched.length === 1 ? matched[0]! : null
}
export const groupLabel = (group: unknown) => normalizeGroup(group) || '待分组'
export const groupAbbr = (group: unknown) => GROUP_CONFIG.find(g=>g.name===normalizeGroup(group))?.abbr || '—'
export const normalizeTaskCategory = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : ''
  return ['其他','其他任务'].includes(text) ? '联调任务' : text
}
