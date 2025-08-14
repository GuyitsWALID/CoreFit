import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ztzfvotpltombchdnmha.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0emZ2b3RwbHRvbWJjaGRubWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NTYzMzQsImV4cCI6MjA2NjQzMjMzNH0.SGHZnyFc_neVS55i63Fgb2tVJZfUwJV_1UkfhX2WzJY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

//C:\Users\walid\OneDrive\Desktop\atl-fitness-hub-main\src\supabaseClient.ts