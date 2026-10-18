/* global require, module */
const supabase = require('../config/database')

const getMembership = async (conversationId, userId) => {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  return { membership: data, error }
}

const createConversation = async (req, res) => {
  const { name, type = 'group', memberIds = [] } = req.body
  const members = [...new Set([req.user.id, ...memberIds].filter(Boolean))]

  if (type === 'direct') {
    const otherMember = members.find((userId) => userId !== req.user.id)
    if (!otherMember) return res.status(400).json({ error: 'Select a user to message.' })

    const { data: otherUser, error: otherUserError } = await supabase
      .from('users')
      .select('id, full_name, username, avatar_url')
      .eq('id', otherMember)
      .maybeSingle()

    if (otherUserError) return res.status(500).json({ error: otherUserError.message })

    const conversationName = otherUser?.full_name || otherUser?.username || name?.trim() || 'Direct message'

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({ name: conversationName, type, created_by: req.user.id })
      .select('id, type, name, created_at, updated_at')
      .single()

    if (conversationError) return res.status(500).json({ error: conversationError.message })

    const { error: memberError } = await supabase
      .from('conversation_members')
      .upsert(members.map((userId) => ({ conversation_id: conversation.id, user_id: userId })), {
        onConflict: 'conversation_id,user_id',
        ignoreDuplicates: true,
      })

    if (memberError) {
      await supabase.from('conversations').delete().eq('id', conversation.id)
      return res.status(500).json({ error: memberError.message })
    }

    return res.status(201).json({
      ...conversation,
      memberIds: members,
      avatar_url: otherUser?.avatar_url ?? null,
    })
  }

  const conversationName = name?.trim()

  if (type !== 'direct' && !conversationName) return res.status(400).json({ error: 'Conversation name is required' })

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({ name: conversationName, type, created_by: req.user.id })
    .select('id, type, name, created_at, updated_at')
    .single()

  if (conversationError) return res.status(500).json({ error: conversationError.message })

  const { error: memberError } = await supabase
    .from('conversation_members')
    .upsert(members.map((userId) => ({ conversation_id: conversation.id, user_id: userId })), {
      onConflict: 'conversation_id,user_id',
      ignoreDuplicates: true,
    })

  if (memberError) {
    await supabase.from('conversations').delete().eq('id', conversation.id)
    return res.status(500).json({ error: memberError.message })
  }

  res.status(201).json({ ...conversation, memberIds: members })
}

const renameConversation = async (req, res) => {
  const { membership, error: membershipError } = await getMembership(req.params.conversationId, req.user.id)
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

  const name = req.body.name?.trim()
  if (!name) return res.status(400).json({ error: 'Conversation name is required' })

  const { data, error } = await supabase
    .from('conversations')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', req.params.conversationId)
    .select('id, type, name, created_at, updated_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

const addMembers = async (req, res) => {
  const { membership, error: membershipError } = await getMembership(req.params.conversationId, req.user.id)
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

  const memberIds = [...new Set((req.body.memberIds ?? []).filter(Boolean))]
  if (!memberIds.length) return res.status(400).json({ error: 'Select at least one user' })

  const { data, error } = await supabase
    .from('conversation_members')
    .upsert(memberIds.map((userId) => ({ conversation_id: req.params.conversationId, user_id: userId })), {
      onConflict: 'conversation_id,user_id',
      ignoreDuplicates: true,
    })
    .select('conversation_id, user_id')

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
}

const removeMember = async (req, res) => {
  const { membership, error: membershipError } = await getMembership(req.params.conversationId, req.user.id)
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', req.params.conversationId)
    .eq('user_id', req.params.userId)

  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
}

const leaveConversation = async (req, res) => {
  req.params.userId = req.user.id
  return removeMember(req, res)
}

const updateConversationState = async (req, res) => {
  const { membership, error: membershipError } = await getMembership(req.params.conversationId, req.user.id)
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

  const updates = {}
  if (typeof req.body?.pinned === 'boolean') updates.pinned = req.body.pinned
  if (typeof req.body?.archived === 'boolean') updates.archived = req.body.archived

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid conversation state update provided.' })
  }

  const { data, error } = await supabase
    .from('conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', req.params.conversationId)
    .select('id, type, name, pinned, archived, created_at, updated_at')
    .single()

  if (error) {
    if (error.message?.toLowerCase().includes('column') || error.code === '42703') {
      return res.status(400).json({ error: 'The conversations table does not yet include the pinned/archived fields. Run the migration first.' })
    }
    return res.status(500).json({ error: error.message })
  }

  res.status(200).json(data)
}

const deleteConversation = async (req, res) => {
  const { membership, error: membershipError } = await getMembership(req.params.conversationId, req.user.id)
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

  const { error: messagesError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', req.params.conversationId)

  if (messagesError) return res.status(500).json({ error: messagesError.message })

  const { error: membersError } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', req.params.conversationId)

  if (membersError) return res.status(500).json({ error: membersError.message })

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', req.params.conversationId)

  if (error) return res.status(500).json({ error: error.message })

  res.status(200).json({ success: true, conversationId: req.params.conversationId })
}

module.exports = {
  createConversation,
  renameConversation,
  addMembers,
  removeMember,
  leaveConversation,
  updateConversationState,
  deleteConversation,
}
