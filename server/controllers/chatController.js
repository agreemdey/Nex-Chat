/* global require, module */
const supabase = require('../config/database')
const { normalizeBlockedSet, isConversationBlockedForUser } = require('../utils/blocking')

const getChats = async (req, res) => {
    try {
        const { data: membershipRows, error: membershipError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', req.user.id)

        if (membershipError) {
            return res.status(500).json({
                error: membershipError.message,
            })
        }

        const conversationIds = [...new Set((membershipRows ?? []).map((row) => row.conversation_id).filter(Boolean))]

        if (!conversationIds.length) {
            return res.status(200).json([])
        }

        const { data: blockedRows, error: blockedError } = await supabase
            .from('blocked_users')
            .select('blocked_id')
            .eq('blocker_id', req.user.id)

        if (blockedError) {
            return res.status(500).json({ error: blockedError.message })
        }

        const { data: blockedMeRows, error: blockedMeError } = await supabase
            .from('blocked_users')
            .select('blocker_id')
            .eq('blocked_id', req.user.id)

        if (blockedMeError) {
            return res.status(500).json({ error: blockedMeError.message })
        }

        const blockedByCurrentUser = normalizeBlockedSet(blockedRows ?? [])
        const blockedAgainstCurrentUser = normalizeBlockedSet(blockedMeRows ?? [])

        const { data, error } = await supabase
            .from('conversations')
            .select(`
                id,
                type,
                name,
                pinned,
                archived,
                created_at,
                updated_at,
                conversation_members (
                    user_id
                )
            `)
            .in('id', conversationIds)

        if (error) {
            return res.status(500).json({
                error: error.message,
            })
        }

        const { data: messageRows, error: messageError } = await supabase
            .from('messages')
            .select('id, conversation_id, content, created_at, sender_id')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: true })

        if (messageError) {
            return res.status(500).json({
                error: messageError.message,
            })
        }

        const latestMessageByConversation = new Map()
        ;(messageRows ?? []).forEach((message) => {
            const current = latestMessageByConversation.get(message.conversation_id)
            if (!current || new Date(message.created_at).getTime() >= new Date(current.created_at).getTime()) {
                latestMessageByConversation.set(message.conversation_id, message)
            }
        })

        const { data: unreadRows, error: unreadError } = await supabase
            .from('messages')
            .select('conversation_id, read_at, sender_id')
            .in('conversation_id', conversationIds)
            .neq('sender_id', req.user.id)

        if (unreadError) {
            return res.status(500).json({
                error: unreadError.message,
            })
        }

        const unreadCountsByConversation = new Map()
        ;(unreadRows ?? []).forEach((message) => {
            if (!message.read_at) {
                unreadCountsByConversation.set(
                    message.conversation_id,
                    (unreadCountsByConversation.get(message.conversation_id) ?? 0) + 1,
                )
            }
        })

        const memberIds = [...new Set((data ?? []).flatMap((conversation) => (conversation.conversation_members ?? []).map((member) => member.user_id)).filter(Boolean))]

        let userMap = new Map()
        if (memberIds.length) {
            const { data: userRows, error: usersError } = await supabase
                .from('users')
                .select('id, full_name, username, avatar_url')

            if (usersError) {
                return res.status(500).json({ error: usersError.message })
            }

            userMap = new Map((userRows ?? []).map((user) => [user.id, user]))
        }

        const normalized = (data ?? [])
            .map((conversation) => {
                const nextConversation = {
                    ...conversation,
                    last_message: '',
                    lastMessage: '',
                    preview: 'No messages yet',
                    updated_at: conversation.updated_at,
                    unread_count: 0,
                    unreadCount: 0,
                }

                const latestMessage = latestMessageByConversation.get(conversation.id)
                const lastMessageText = latestMessage?.content ?? ''
                const unreadCount = unreadCountsByConversation.get(conversation.id) ?? 0

                const preparedConversation = {
                    ...nextConversation,
                    last_message: lastMessageText,
                    lastMessage: lastMessageText,
                    preview: lastMessageText || conversation.preview || 'No messages yet',
                    updated_at: latestMessage?.created_at ?? conversation.updated_at,
                    unread_count: unreadCount,
                    unreadCount,
                }

                if (conversation.type !== 'direct') return preparedConversation

                const memberIdsInConversation = (conversation.conversation_members ?? []).map((member) => member.user_id).filter(Boolean)
                const otherUserId = memberIdsInConversation.find((userId) => userId !== req.user.id)
                const otherUser = otherUserId ? userMap.get(otherUserId) : null

                if (isConversationBlockedForUser(req.user.id, memberIdsInConversation, blockedByCurrentUser, blockedAgainstCurrentUser)) {
                    return null
                }

                return {
                    ...preparedConversation,
                    avatar_url: otherUser?.avatar_url ?? preparedConversation.avatar_url ?? null,
                    name: otherUser
                        ? (otherUser.full_name || otherUser.username || conversation.name || 'Direct message')
                        : (conversation.name || 'Direct message'),
                }
            })
            .filter(Boolean)

        res.status(200).json(normalized)
    } catch (error) {
        console.error(error)
        res.status(500).json({
            error: 'Internal server error',
        })
    }
}

module.exports = { getChats }