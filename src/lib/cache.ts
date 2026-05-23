import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function getCached(key: string) {
  try {
    const { data } = await supabase
      .from('cache')
      .select('payload, updated_at')
      .eq('key', key)
      .single()
    return data
  } catch {
    return null
  }
}

export async function setCached(key: string, payload: any) {
  try {
    await supabase.from('cache').upsert({
      key,
      payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
  } catch (e) {
    // cache write failure is non-fatal
  }
}
