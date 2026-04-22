import { supabase } from '@/lib/supabase'

export interface Template {
  id: string
  label: string
  kind: 'v' | 'b'
  name: string
  dose_number: number | null
  total_doses: number | null
  next_due_days: number | null
  created_at: string
}

export type TemplateInput = Omit<Template, 'id' | 'created_at'>

export async function listTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('qr_templates')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Template[]
}

export async function saveTemplate(input: TemplateInput): Promise<Template> {
  const { data, error } = await supabase
    .from('qr_templates')
    .insert({
      label: input.label,
      kind: input.kind,
      name: input.name,
      dose_number: input.dose_number,
      total_doses: input.total_doses,
      next_due_days: input.next_due_days,
    })
    .select()
    .single()
  if (error) throw error
  return data as Template
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('qr_templates').delete().eq('id', id)
  if (error) throw error
}

export function autoLabel(t: Omit<TemplateInput, 'label'>): string {
  const parts: string[] = [t.name.trim() || 'Untitled']
  if (t.kind === 'v' && t.dose_number && t.total_doses) {
    parts.push(`Dose ${t.dose_number} of ${t.total_doses}`)
  }
  if (t.next_due_days) parts.push(`+${t.next_due_days}d`)
  return parts.join(' · ')
}
