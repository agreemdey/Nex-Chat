/* global require, module */
const supabase = require('../config/database')

async function getUsers(req, res) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, full_name, email, avatar_url, bio')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

async function getUserById(req, res) {
  const { id } = req.params

  if (!id) {
    return res.status(400).json({ error: 'User id is required' })
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, username, full_name, email, avatar_url, bio')
    .eq('id', id)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'User not found' })

  res.json(data)
}

async function createUserProfile(req, res) {
  const { username, full_name, email, avatar_url, bio } = req.body

  if (!username || !full_name || !email) {
    return res.status(400).json({ error: 'username, full_name, and email are required' })
  }

  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: req.user.id,
      username,
      full_name,
      email,
      avatar_url: avatar_url || null,
      bio: bio || 'Available for a quick chat',
    }, { onConflict: 'id' })
    .select('id, username, full_name, email, avatar_url, bio')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
}

async function searchUsers(req, res) {
  const query = req.query.q?.trim()
  if (!query) return res.json([])

  const { data, error } = await supabase
    .from('users')
    .select('id, username, full_name, email, avatar_url, bio')
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .neq('id', req.user.id)
    .limit(20)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

async function getBlockedUsers(req, res) {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at')
    .eq('blocker_id', req.user.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  res.json((data ?? []).map((row) => ({
    user_id: row.blocked_id,
    blocked_id: row.blocked_id,
    created_at: row.created_at,
  })))
}

async function blockUser(req, res) {
  const blockedId = req.params.id

  if (!blockedId) {
    return res.status(400).json({ error: 'User id is required' })
  }

  if (blockedId === req.user.id) {
    return res.status(400).json({ error: 'You cannot block yourself.' })
  }

  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id')
    .eq('id', blockedId)
    .maybeSingle()

  if (targetError) return res.status(500).json({ error: targetError.message })
  if (!targetUser) return res.status(404).json({ error: 'User not found' })

  const { data, error } = await supabase
    .from('blocked_users')
    .upsert({
      blocker_id: req.user.id,
      blocked_id: blockedId,
    }, {
      onConflict: 'blocker_id,blocked_id',
      ignoreDuplicates: false,
    })
    .select('blocker_id, blocked_id, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  res.status(201).json({
    blocker_id: data.blocker_id,
    blocked_id: data.blocked_id,
    created_at: data.created_at,
  })
}

async function unblockUser(req, res) {
  const blockedId = req.params.id

  if (!blockedId) {
    return res.status(400).json({ error: 'User id is required' })
  }

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', req.user.id)
    .eq('blocked_id', blockedId)

  if (error) return res.status(500).json({ error: error.message })

  res.status(200).json({
    success: true,
    blocker_id: req.user.id,
    blocked_id: blockedId,
  })
}

module.exports = {
  getUsers,
  getUserById,
  createUserProfile,
  searchUsers,
  getBlockedUsers,
  blockUser,
  unblockUser,
}