const test = require('node:test')
const assert = require('node:assert/strict')

const { isBlockedByUser, isConversationBlockedForUser } = require('../utils/blocking')

test('isBlockedByUser returns true when the target is in the current user block list', () => {
  const blockedSet = new Set(['user-2'])
  assert.equal(isBlockedByUser('user-1', 'user-2', blockedSet), true)
  assert.equal(isBlockedByUser('user-1', 'user-3', blockedSet), false)
  assert.equal(isBlockedByUser('user-3', 'user-2', blockedSet), true)
})

test('isConversationBlockedForUser rejects direct chats when either side has blocked the other', () => {
  assert.equal(
    isConversationBlockedForUser('user-1', ['user-1', 'user-2'], new Set(['user-2']), new Set()),
    true,
  )
  assert.equal(
    isConversationBlockedForUser('user-1', ['user-1', 'user-2'], new Set(), new Set(['user-2'])),
    true,
  )
  assert.equal(
    isConversationBlockedForUser('user-1', ['user-1', 'user-3'], new Set(), new Set()),
    false,
  )
})
