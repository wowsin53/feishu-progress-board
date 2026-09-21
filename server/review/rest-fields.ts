import type { FieldMetadata } from './schema'
export interface RestField { field_name: string; type: number; property?: { multiple?: boolean; options?: { name: string }[]; table_id?: string } | null }
/** REST types verified against the existing table; never infer a business field from its position. */
export function restFields(rows: RestField[]): FieldMetadata[] {
  const types: Record<number, string> = { 1: 'text', 3: 'select', 4: 'select', 5: 'datetime', 11: 'user', 18: 'link', 1001: 'created_at', 1003: 'created_by' }
  return rows.map(f => ({ name: f.field_name, type: types[f.type] ?? 'unknown',
    multiple: f.type === 4 ? true : f.type === 3 ? false : f.property?.multiple,
    options: f.property?.options, link_table: f.property?.table_id }))
}
