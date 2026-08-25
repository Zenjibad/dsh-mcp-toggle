import { isLocked } from '../lib/index.js'

const assert = (c, m) => {
  if (!c) {
    console.error('FAIL: ' + m)
    process.exit(1)
  }
}
assert(isLocked('include', 'anything') === true, 'include id locked')
assert(isLocked('my-mcp', 'cordis:include') === true, 'cordis:include name locked')
assert(isLocked('my-mcp', 'dsh-mcp-toggle') === true, 'own name locked')
assert(isLocked('my-mcp', 'some-server') === false, 'normal entry not locked')
console.log('PASS: locked-entry guard')
