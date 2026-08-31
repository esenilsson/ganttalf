import { newId } from './excel.js'

// Runner tournament preparation — race day 2026-11-28.
const raw = [
  ['Planning', 'Define tournament concept & budget', null, '2026-09-01', '2026-09-11', null, null, 'Emil'],
  ['Planning', 'Secure venue & course permits', null, '2026-09-07', '2026-09-25', '2026-10-02', null, 'Anna'],
  ['Planning', 'Permits approved', null, null, null, null, '2026-10-02', ''],
  ['Registration', 'Open registration & payment setup', null, '2026-09-21', '2026-10-02', null, null, 'Johan'],
  ['Registration', 'Registration window', null, '2026-10-05', '2026-11-13', null, null, 'Johan', 'Open registration & payment setup'],
  ['Registration', 'Seeding & start groups', null, '2026-11-16', '2026-11-20', null, null, 'Johan', 'Registration window'],
  ['Marketing', 'Sponsor outreach', '2026-09-07', '2026-09-14', '2026-10-16', null, null, 'Sara'],
  ['Marketing', 'Campaign & social media push', null, '2026-10-05', '2026-11-20', null, null, 'Sara'],
  ['Marketing', 'Sponsor package signed', null, null, null, null, '2026-10-16', ''],
  ['Logistics', 'Course marking & timing system', null, '2026-11-02', '2026-11-20', null, null, 'Anna'],
  ['Logistics', 'Volunteer recruitment & briefing', null, '2026-10-19', '2026-11-25', null, null, 'Emil'],
  ['Logistics', 'Medals, bibs & goodie bags', null, '2026-10-26', '2026-11-18', '2026-11-24', null, 'Sara'],
  ['Race week', 'Course rehearsal & dry run', null, '2026-11-23', '2026-11-26', null, null, 'Anna', 'Course marking & timing system'],
  ['Race week', 'Race day', null, null, null, null, '2026-11-28', '', 'Course rehearsal & dry run'],
  ['Race week', 'Results, prizes & wrap-up', null, '2026-11-28', '2026-12-04', null, null, 'Emil'],
]

export function sampleRows() {
  return raw.map(([group, activity, tentativeStart, start, end, tentativeEnd, milestone, responsible, dependsOn]) => ({
    id: newId(), group, activity, tentativeStart, start, end, tentativeEnd, milestone, responsible,
    dependsOn: dependsOn ?? '',
  }))
}
