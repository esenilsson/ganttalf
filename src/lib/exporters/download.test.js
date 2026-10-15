import { describe, expect, it } from 'vitest'
import { exportBaseName } from './download.js'

describe('exportBaseName', () => {
  it('prefers the chart name over the file name', () => {
    expect(exportBaseName('Q3 roadmap', 'plan.xlsx')).toBe('Q3 roadmap')
  })

  it('falls back to the file name without its extension', () => {
    expect(exportBaseName(null, 'plan.xlsx')).toBe('plan')
    expect(exportBaseName('  ', 'plan.CSV')).toBe('plan')
  })

  it('replaces characters filesystems reject', () => {
    expect(exportBaseName('Q3/Q4: plan?', null)).toBe('Q3-Q4- plan')
  })

  it('falls back to a default name', () => {
    expect(exportBaseName(null, null)).toBe('Untitled project')
    expect(exportBaseName('///', null)).toBe('Untitled project')
  })
})
