import { supabase } from './supabase.js'

export const auth = $state({ user: null, ready: false })

// Resolves once the initial session is known — including the PKCE code exchange
// after the OAuth redirect. Boot logic must await this before any RLS query,
// or queries run as anon and owned charts look like they don't exist.
export const authReady = new Promise((resolve) => {
  supabase.auth.onAuthStateChange((_event, session) => {
    auth.user = session?.user ?? null
    auth.ready = true
    resolve()
  })
})

export function signIn() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  })
}

export async function signOut() {
  await supabase.auth.signOut()
}
