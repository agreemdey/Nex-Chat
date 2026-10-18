/* global require, module */
const express = require('express')

const { getUsers, getUserById, createUserProfile, searchUsers } = require('../controllers/userController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', requireAuth, getUsers)
router.get('/search', requireAuth, searchUsers)
router.get('/:id', requireAuth, getUserById)
router.post('/profile', requireAuth, createUserProfile)

module.exports = router