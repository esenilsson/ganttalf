#!/usr/bin/env node
// Guards the invariants the Ganttalf skill depends on. Run locally with
// `node scripts/check-skill.mjs`; CI runs the same file.
//
//   1. SKILL.md frontmatter is present and inside the Claude app's field limits
//   2. .claude-plugin/marketplace.json is well formed and its paths resolve
//   3. the skill's FIELDS order matches src/lib/share.js
//   4. a chart survives the skill encoder → app decoder round trip
//   5. a chart survives the skill's .xlsx writer → app parser round trip
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(ROOT, '.claude/skills/ganttalf')
const SCRIPT = join(SKILL_DIR, 'make-gantt.mjs')

// Claude app limits (Customize → Skills → Add → Upload a skill)
const NAME_MAX = 64
const DESC_MAX = 200

let failures = 0
const check = async (name, fn) => {
  try {
    const note = await fn()
    console.log(`  ok    ${name}${note ? ` (${note})` : ''}`)
  } catch (e) {
    console.error(`  FAIL  ${name}\n        ${e.message.replace(/\n/g, '\n        ')}`)
    failures++
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const FIXTURE = [
  { group: 'Build', activity: 'Design', start: '2026-03-02', end: '2026-03-20', responsible: 'EN' },
  { group: 'Build', activity: 'Implementation', tentativeStart: '2026-03-21', start: '2026-03-23', end: '2026-04-24', tentativeEnd: '2026-05-01', dependsOn: 'Design' },
  { group: 'Launch', activity: 'Go live', milestone: '2026-05-11' },
  { activity: 'Ungrouped, dates only', start: '2026-05-12', end: '2026-05-20' },
]

const FIELDS = ['group', 'activity', 'tentativeStart', 'start', 'end', 'tentativeEnd', 'milestone', 'responsible', 'dependsOn']
// null and '' both mean "absent"; the app fills text fields with '' on decode.
const normalise = (rows) =>
  rows.map((r) => Object.fromEntries(FIELDS.map((f) => [f, r[f] === '' || r[f] === undefined ? null : r[f]])))

const diff = (a, b) => {
  const A = normalise(a)
  const B = normalise(b)
  assert(A.length === B.length, `row count ${A.length} vs ${B.length}`)
  for (let i = 0; i < A.length; i++) {
    for (const f of FIELDS) {
      assert(A[i][f] === B[i][f], `row ${i + 1} field "${f}": ${JSON.stringify(A[i][f])} vs ${JSON.stringify(B[i][f])}`)
    }
  }
}

console.log('Ganttalf skill checks\n')

// --- 1. SKILL.md -----------------------------------------------------------
let skillMd = ''
await check('SKILL.md frontmatter within Claude app limits', () => {
  assert(existsSync(join(SKILL_DIR, 'SKILL.md')), 'no SKILL.md in .claude/skills/ganttalf')
  skillMd = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')
  assert(skillMd.startsWith('---\n'), 'frontmatter must be the first line')
  const fm = skillMd.slice(4, skillMd.indexOf('\n---', 4))
  const field = (k) => (fm.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1]
  const name = field('name')
  const desc = field('description')
  assert(name, 'missing name')
  assert(desc, 'missing description')
  assert(name.length <= NAME_MAX, `name is ${name.length} chars, limit ${NAME_MAX}`)
  assert(desc.length <= DESC_MAX, `description is ${desc.length} chars, limit ${DESC_MAX}`)
  return `name ${name.length}, description ${desc.length} chars`
})

// --- 2. marketplace.json ---------------------------------------------------
await check('marketplace.json is well formed and its paths resolve', () => {
  const path = join(ROOT, '.claude-plugin/marketplace.json')
  assert(existsSync(path), 'no .claude-plugin/marketplace.json')
  const m = JSON.parse(readFileSync(path, 'utf8'))
  assert(m.name, 'missing name')
  assert(m.owner?.name, 'missing owner.name')
  assert(Array.isArray(m.plugins) && m.plugins.length, 'plugins must be a non-empty array')
  for (const p of m.plugins) {
    assert(p.name, 'a plugin entry has no name')
    assert(p.source, `plugin "${p.name}" has no source`)
    for (const dir of p.skills ?? []) {
      assert(existsSync(join(ROOT, dir)), `plugin "${p.name}" points at missing skills dir ${dir}`)
      assert(existsSync(join(ROOT, dir, 'SKILL.md')), `${dir} has no SKILL.md`)
    }
  }
  return `${m.plugins.length} plugin entry`
})

// --- 3. field order parity -------------------------------------------------
await check('FIELDS order matches src/lib/share.js', () => {
  const grab = (file) => {
    const src = readFileSync(join(ROOT, file), 'utf8')
    const m = src.match(/const FIELDS = (\[[^\]]*\])/)
    assert(m, `no FIELDS array found in ${file}`)
    return JSON.parse(m[1].replace(/'/g, '"'))
  }
  const app = grab('src/lib/share.js')
  const skill = grab('.claude/skills/ganttalf/make-gantt.mjs')
  assert(
    JSON.stringify(app) === JSON.stringify(skill),
    `share.js has ${JSON.stringify(app)}\n        make-gantt.mjs has ${JSON.stringify(skill)}`
  )
  return `${app.length} fields`
})

// --- 4 & 5. round trips ----------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), 'ganttalf-check-'))
const rowsJson = join(tmp, 'rows.json')
const xlsxOut = join(tmp, 'chart.xlsx')
writeFileSync(rowsJson, JSON.stringify(FIXTURE))

let shareUrl = ''
await check('skill script runs and emits a share URL', () => {
  const out = execFileSync('node', [SCRIPT, rowsJson, xlsxOut], { encoding: 'utf8' })
  const m = out.match(/Share URL: (\S+)/)
  assert(m, `no Share URL in output:\n${out}`)
  assert(existsSync(xlsxOut), 'no .xlsx written (is xlsx installed?)')
  shareUrl = m[1]
  return `${FIXTURE.length} rows`
})

await check('share link decodes through src/lib/share.js', async () => {
  const { decodeRows } = await import(join(ROOT, 'src/lib/share.js'))
  const token = shareUrl.slice(shareUrl.indexOf('#g=') + 3)
  diff(FIXTURE, await decodeRows(token))
  return 'byte-compatible'
})

await check('.xlsx re-imports through src/lib/excel.js', async () => {
  const { parseWorkbook } = await import(join(ROOT, 'src/lib/excel.js'))
  const bytes = readFileSync(xlsxOut)
  diff(FIXTURE, await parseWorkbook(new Blob([bytes])))
  return 'headers and dates preserved'
})

await check('--read recovers the rows from the share link', async () => {
  const out = execFileSync('node', [SCRIPT, '--read', shareUrl], { encoding: 'utf8' })
  diff(FIXTURE, JSON.parse(out))
  return 'lossless'
})

await check('--read recovers the rows from the .xlsx', async () => {
  const out = execFileSync('node', [SCRIPT, '--read', xlsxOut], { encoding: 'utf8' })
  diff(FIXTURE, JSON.parse(out))
  return 'lossless'
})

console.log()
if (failures) {
  console.error(`${failures} check${failures === 1 ? '' : 's'} failed.`)
  process.exit(1)
}
console.log('All checks passed.')
