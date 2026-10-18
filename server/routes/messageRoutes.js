/* global require, module */
const express = require('express')

const { getMessages, sendMessage, markConversationRead, editMessage, deleteMessage, togglePinMessage, clearConversationMessages } = require('../controllers/messageController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/:conversationId', requireAuth, getMessages)
router.patch('/:conversationId/read', requireAuth, markConversationRead)
router.delete('/:conversationId/clear', requireAuth, clearConversationMessages)
router.patch('/message/:messageId', requireAuth, editMessage)
router.patch('/message/:messageId/pin', requireAuth, togglePinMessage)
router.delete('/message/:messageId', requireAuth, deleteMessage)

router.post('/', requireAuth, sendMessage)

module.exports = router