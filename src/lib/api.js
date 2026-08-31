// Thin client over supabase-js. Signatures preserved from the old Fastify version;
// SaveMenu's save-a-copy fallback depends on err.status being 404 when a row is
// RLS-hidden or deleted.
import { supabase } from './supabase.js'

function fail(status, message) {
  const err = new Error(message)
  err.status = status
  throw err
}

export async function listCharts() {
  const { data, error } = await supabase
    .from('charts')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })
  if (error) fail(500, error.message)
  return data
}

export async function getChart(id) {
  const { data, error } = await supabase
    .from('charts')
    .select('id, name, data, updated_at, share_token')
    .eq('id', id)
    .maybeSingle()
  if (error) fail(500, error.message)
  if (!data) fail(404, 'not found') // missing OR not yours — same thing under RLS
  return data
}

export async function createChart(name, data) {
  const { data: row, error } = await supabase
    .from('charts')
    .insert({ name, data }) // owner defaults to auth.uid()
    .select('id')
    .single()
  if (error) fail(error.code === '42501' ? 403 : 500, error.message)
  return row
}

export async function updateChart(id, patch) {
  const { data: row, error } = await supabase
    .from('charts')
    .update(patch) // { name } and/or { data } and/or { share_token }
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) fail(500, error.message)
  if (!row) fail(404, 'not found') // RLS-hidden or deleted → save-a-copy path
  return { ok: true }
}

export async function deleteChart(id) {
  const { error } = await supabase.from('charts').delete().eq('id', id)
  if (error) fail(500, error.message)
}

// --- sharing ---

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export async function getSharedChart(token) {
  const { data, error } = await supabase.rpc('get_shared_chart', { p_token: token })
  if (error) fail(500, error.message)
  if (!data?.length) fail(404, 'not found')
  return data[0] // { name, data, updated_at }
}

export async function ensureShareToken(id) {
  const { share_token } = await getChart(id)
  if (share_token) return share_token
  const token = newToken()
  await updateChart(id, { share_token: token })
  return token
}

export async function revokeShareToken(id) {
  await updateChart(id, { share_token: null })
}
