import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const configurationError =
  !url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)
// No production fallback: an unconfigured build cannot write to the live project.
export const supabase = createClient(
  configurationError ? 'https://unconfigured.invalid' : url!,
  configurationError ? 'unconfigured' : key!,
)
