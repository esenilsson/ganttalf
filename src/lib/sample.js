import { newId } from './excel.js'

// The quest of the Ring — from Bag End to Mount Doom, autumn 2026.
const raw = [
  ['The Shire', 'Keep the Ring secret & pack', null, '2026-09-01', '2026-09-18', null, null, 'Frodo'],
  ['The Shire', 'Research the Ring in the archives', '2026-09-04', '2026-09-08', '2026-09-21', null, null, 'Gandalf'],
  ['The Shire', 'Departure from Bag End', null, null, null, null, '2026-09-22', ''],
  ['The Road East', 'Cross the Old Forest to Bree', null, '2026-09-22', '2026-10-02', null, null, 'Merry', 'Departure from Bag End'],
  ['The Road East', 'Meet Strider at the Prancing Pony', null, null, null, null, '2026-10-02', ''],
  ['The Road East', 'Flight to the Ford of Rivendell', null, '2026-10-03', '2026-10-20', null, null, 'Aragorn', 'Cross the Old Forest to Bree'],
  ['Rivendell', 'Recovery & Council of Elrond', null, '2026-10-21', '2026-10-30', null, null, 'Elrond'],
  ['Rivendell', 'The Fellowship is formed', null, null, null, null, '2026-10-30', ''],
  ['Rivendell', 'Provisioning & route planning', null, '2026-10-31', '2026-11-10', null, null, 'Sam'],
  ['Misty Mountains', 'Attempt the Caradhras pass', null, '2026-11-11', '2026-11-16', null, null, 'Gandalf'],
  ['Misty Mountains', 'Through the Mines of Moria', null, '2026-11-17', '2026-11-24', '2026-11-28', null, 'Gimli', 'Attempt the Caradhras pass'],
  ['Misty Mountains', 'Rest & gifts in Lothlórien', null, '2026-11-28', '2026-12-04', null, null, 'Galadriel'],
  ['Mordor', 'Down the Anduin, Fellowship breaks', null, '2026-12-04', '2026-12-10', null, null, 'Boromir'],
  ['Mordor', 'The secret stair via Cirith Ungol', '2026-12-08', '2026-12-11', '2026-12-20', null, null, 'Gollum'],
  ['Mordor', 'The Ring goes into the fire', null, null, null, null, '2026-12-25', '', 'The secret stair via Cirith Ungol'],
]

export function sampleRows() {
  return raw.map(([group, activity, tentativeStart, start, end, tentativeEnd, milestone, responsible, dependsOn]) => ({
    id: newId(), group, activity, tentativeStart, start, end, tentativeEnd, milestone, responsible,
    dependsOn: dependsOn ?? '',
  }))
}
