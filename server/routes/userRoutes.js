/* global require, module */
const express = require('express')

const {
  getUsers,
  getUserById,
  createUserProfile,
  searchUsers,
  getBlockedUsers,
  blockUser,
  unblockUser,
} = require('../controllers/userController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', requireAuth, getUsers)
router.get('/blocked', requireAuth, getBlockedUsers)
router.get('/search', requireAuth, searchUsers)
router.post('/:id/block', requireAuth, blockUser)
router.delete('/:id/block', requireAuth, unblockUser)
router.get('/:id', requireAuth, getUserById)
router.post('/profile', requireAuth, createUserProfile)

module.exports = router