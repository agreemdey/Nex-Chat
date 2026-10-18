/* global require, module */
const express = require('express')

const { getChats } = require('../controllers/chatController')
const {
	createConversation,
	renameConversation,
	addMembers,
	removeMember,
	leaveConversation,
	updateConversationState,
	deleteConversation,
} = require('../controllers/conversationController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', requireAuth, getChats)
router.post('/', requireAuth, createConversation)
router.patch('/:conversationId', requireAuth, renameConversation)
router.patch('/:conversationId/state', requireAuth, updateConversationState)
router.delete('/:conversationId', requireAuth, deleteConversation)
router.post('/:conversationId/members', requireAuth, addMembers)
router.delete('/:conversationId/members/:userId', requireAuth, removeMember)
router.delete('/:conversationId/leave', requireAuth, leaveConversation)

module.exports = router