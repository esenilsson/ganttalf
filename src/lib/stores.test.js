import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { store, addRow, convertToMilestone, isMilestoneOnly, groupAtDrop, addTentative } from './stores.svelte.js'

const task = (fields) => ({
  group: 'G', activity: 'A', tentativeStart: null, start: null, end: null,
  tentativeEnd: null, milestone: null, responsible: '', dependsOn: '', ...fields,
})

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 15, 12) })
  store.rows = [task({ start: '2026-01-05', end: '2026-01-20' })]
})

afterEach(() => vi.useRealTimers())

describe('addRow', () => {
  it('inserts a task copying the previous row’s group and dates', () => {
    addRow(0)
    expect(store.rows[1]).toMatchObject({ group: 'G', activity: 'New activity', start: '2026-01-05', end: '2026-01-20', milestone: null })
  })

  it('inserts a milestone dated at the previous row’s start', () => {
    addRow(0, 'milestone')
    expect(store.rows[1]).toMatchObject({ activity: 'New milestone', start: null, end: null, milestone: '2026-01-05' })
  })

  it('dates a milestone today when there is nothing to copy', () => {
    store.rows = []
    addRow(-1, 'milestone')
    expect(store.rows[0].milestone).toBe('2026-10-15')
  })
})

describe('convertToMilestone', () => {
  it('moves the start date to the milestone and clears task dates', () => {
    store.rows[0].tentativeEnd = '2026-01-25'
    convertToMilestone(0)
    expect(store.rows[0]).toMatchObject({ milestone: '2026-01-05', tentativeStart: null, start: null, end: null, tentativeEnd: null })
    expect(isMilestoneOnly(store.rows[0])).toBe(true)
  })

  it('keeps an existing milestone date', () => {
    store.rows[0].milestone = '2026-02-01'
    convertToMilestone(0)
    expect(store.rows[0].milestone).toBe('2026-02-01')
  })
})

describe('isMilestoneOnly', () => {
  it('is false for tasks, undated rows, and tasks that also have a milestone', () => {
    expect(isMilestoneOnly(task({ start: '2026-01-05' }))).toBe(false)
    expect(isMilestoneOnly(task())).toBe(false)
    expect(isMilestoneOnly(task({ end: '2026-01-05', milestone: '2026-01-05' }))).toBe(false)
  })
})

describe('groupAtDrop', () => {
  const rows = [task({ group: 'A' }), task({ group: 'A' }), task({ group: 'B' }), task({ group: 'B' }), task({ group: 'C' })]

  it('keeps the row’s group when dragged up to the top of its own group', () => {
    expect(groupAtDrop(rows, 3, 2)).toBe('B')
  })

  it('keeps the row’s group when dragged down to the bottom of its own group', () => {
    expect(groupAtDrop(rows, 0, 1)).toBe('A')
  })

  it('joins the group above when dropped among other groups', () => {
    expect(groupAtDrop(rows, 4, 1)).toBe('A')
    expect(groupAtDrop(rows, 4, 2)).toBe('A')
  })

  it('joins the first group when dropped at the very top', () => {
    expect(groupAtDrop(rows, 4, 0)).toBe('A')
  })
})

describe('addTentative', () => {
  it('starts a tentative phase a week before the start', () => {
    addTentative(0, 'tentativeStart')
    expect(store.rows[0].tentativeStart).toBe('2025-12-29')
  })

  it('ends a tentative phase a week after the end', () => {
    addTentative(0, 'tentativeEnd')
    expect(store.rows[0].tentativeEnd).toBe('2026-01-27')
  })

  it('falls back to today on an undated row', () => {
    store.rows = [task()]
    addTentative(0, 'tentativeEnd')
    expect(store.rows[0].tentativeEnd).toBe('2026-10-22')
  })
})
