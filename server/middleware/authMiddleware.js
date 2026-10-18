/* global require, module */
const supabase = require('../config/database')

async function requireAuth(req, res, next) {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null

  if (!token) {
    return res.status(401).json({ error: 'Bearer token required' })
  }

  let data
  let error

  try {
    ({ data, error } = await supabase.auth.getUser(token))
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  req.user = data.user
  next()
}

module.exports = { requireAuth }
