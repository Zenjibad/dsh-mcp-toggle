import { fiberPhaseLabel } from '../lib/index.js'

const assert = (c, m) => {
  if (!c) {
    console.error('FAIL: ' + m)
    process.exit(1)
  }
}
assert(fiberPhaseLabel(0) === 'pending', 'phase 0 -> pending')
assert(fiberPhaseLabel(2) === 'active', 'phase 2 -> active')
assert(fiberPhaseLabel(3) === 'failed', 'phase 3 -> failed')
assert(fiberPhaseLabel(4) === null, 'phase 4 -> null')
assert(fiberPhaseLabel(999) === null, 'unknown phase -> null')
console.log('PASS: fiber phase labels map')
