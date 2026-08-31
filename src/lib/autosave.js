// Invisible localStorage autosave so a reload/crash never loses work.
// localStorage can throw (private mode, blocked site data) — every touch is guarded.
const KEY = 'ganttalf:autosave'

export function saveLocal(snapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }))
  } catch {
    /* storage unavailable — autosave silently off */
  }
}

export function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(saved?.rows) && saved.rows.length ? saved : null
  } catch {
    return null
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
