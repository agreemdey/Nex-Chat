const normalizeBlockedSet = (rows = []) => new Set(
  (rows ?? [])
    .map((row) => row?.blocked_id ?? row?.blocker_id ?? row?.user_id ?? null)
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(String),
)

const isBlockedByUser = (currentUserId, otherUserId, blockedIds = new Set()) => {
  if (!currentUserId || !otherUserId || String(currentUserId) === String(otherUserId)) {
    return false
  }

  return blockedIds.has(String(otherUserId))
}

const isConversationBlockedForUser = (
  currentUserId,
  memberIds = [],
  blockedByCurrentUser = new Set(),
  blockedAgainstCurrentUser = new Set(),
) => {
  if (!currentUserId || !Array.isArray(memberIds) || !memberIds.length) {
    return false
  }

  const otherMembers = [...new Set(memberIds.map(String).filter((id) => id !== String(currentUserId)))]

  return otherMembers.some((memberId) => (
    blockedByCurrentUser.has(memberId) || blockedAgainstCurrentUser.has(memberId)
  ))
}

module.exports = {
  normalizeBlockedSet,
  isBlockedByUser,
  isConversationBlockedForUser,
}
