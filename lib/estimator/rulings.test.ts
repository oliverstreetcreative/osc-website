import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quote, parseAnswers, parseEdits } from './engine'
import { captureHours, HOURS_PER_SHOOT_DAY, KINDS, storyTotal, STORY_PIECE_APPROVED } from '../story-hours'

const a = parseAnswers({kind: 'story', handles: ['crewGear', 'editing']})
const social = (q: ReturnType<typeof quote>) => q.lines.filter(l => l.group === 'Social versions')
test('social versions default off; included alone adds nothing', () => {
  assert.equal(social(quote(a)).length, 0)
  assert.equal(social(quote(a, {spec: {socialIncluded: true}})).length, 0)
})
test('each format is independently priced; actual cost survives inclusion', () => {
  for (const spec of [{vertical: true}, {square: true}, {vertical: true, square: true}]) {
    const paid = quote(a, parseEdits({spec}))
    const count = Number('vertical' in spec) + Number('square' in spec)
    assert.equal(social(paid).reduce((s,l) => s+l.charge,0), count*300)
    assert.equal(social(paid).reduce((s,l) => s+l.cost,0), count*120)
    assert.ok(paid.total > quote(a).total)
    const included = quote(a, parseEdits({spec: {...spec, socialIncluded: true}}))
    assert.equal(social(included).reduce((s,l) => s+l.charge,0), 0)
    assert.equal(social(included).reduce((s,l) => s+l.cost,0), count*120)
    assert.equal(included.total, quote(a).total)
  }
})
test('requested formats scale with films and disappear on shoot-only bids', () => {
  const edits = parseEdits({spec: {vertical: true, square: true, extraVideos: 2}})
  assert.equal(social(quote(a, edits)).reduce((s,l) => s+l.charge,0), 1800)
  assert.equal(social(quote(parseAnswers({handles:['crewGear']}), edits)).length, 0)
  assert.equal(parseEdits({spec: {vertical: 'true'}}).spec?.vertical, undefined)
})
test('shoot day is ten hours all-in; density boundaries round up; story uses real aggregate hours', () => {
  assert.equal(HOURS_PER_SHOOT_DAY, 10)
  assert.equal(captureHours(3,3),10)
  assert.equal(captureHours(3.1,3),20)
  assert.equal(captureHours(5,1.5),40)
  assert.deepEqual(KINDS.map(k => [k.filming, storyTotal(k)]), [[10,12],[10,36],[40,60]])
  assert.equal(STORY_PIECE_APPROVED, false)
})
