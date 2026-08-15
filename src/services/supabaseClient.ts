import { createClient } from '@supabase/supabase-js'

// Public by design — Supabase's anon/publishable key is safe to ship in a
// client bundle. Access to data is enforced by Postgres Row Level Security
// policies (see the `user_data` table), not by hiding this key.
const SUPABASE_URL = 'https://mqssgixmocovavstuxqs.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5w2xSwg1VlUV-JIE7OvL7Q_0CzhURv0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
