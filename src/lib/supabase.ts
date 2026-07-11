import { createClient } from '@supabase/supabase-js'

// The anon key is a publishable key — it ships in the browser bundle by
// design; all data access is enforced by Row Level Security policies.
const FALLBACK_URL = 'https://fualvmpwfphnhjtqbrmb.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YWx2bXB3ZnBobmhqdHFicm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NjkxMjAsImV4cCI6MjA5OTM0NTEyMH0.hmR04V5xF1bhQlC0luzOY9Fj3HERsJM9bnKVIzWsL9o'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY

export const supabase = createClient(url, anonKey)
