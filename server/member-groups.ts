import { normalizeGroup, type Group } from '../src/config/groups'

// Server-only directory mappings, keyed by stable personnel ID, never by name/order.
export function configuredMemberGroups(raw = process.env.FEISHU_MEMBER_GROUPS_JSON): Record<string, Group> {
  if (!raw?.trim()) return {}
  try {
    const value = JSON.parse(raw)
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error()
    const result: Record<string, Group> = {}
    for (const [id, label] of Object.entries(value)) {
      const group = typeof label === 'string' ? normalizeGroup(label) : null
      if (!id.trim() || !group) throw new Error()
      result[id] = group
    }
    return result
  } catch { throw new Error('INVALID_MEMBER_GROUPS_CONFIG') }
}
