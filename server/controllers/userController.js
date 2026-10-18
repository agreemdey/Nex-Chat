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

module.exports = { getUsers, getUserById, createUserProfile, searchUsers }