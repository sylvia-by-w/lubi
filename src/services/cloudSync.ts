import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export type { Session }

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  // If email confirmation is required, Supabase returns a user but no session.
  return { needsEmailConfirmation: !!data.user && !data.session }
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function fetchRemoteData(userId: string): Promise<{ data: Record<string, unknown>; updatedAt: string } | null> {
  const { data, error } = await supabase
    .from('user_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { data: (data.data ?? {}) as Record<string, unknown>, updatedAt: data.updated_at as string }
}

export async function pushRemoteData(userId: string, data: Record<string, unknown>) {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data }, { onConflict: 'user_id' })
  if (error) throw error
}

/** True if the exported-data JSON has at least one non-empty array field. */
export function snapshotHasContent(data: Record<string, unknown>): boolean {
  return Object.values(data).some(v => Array.isArray(v) && v.length > 0)
}
