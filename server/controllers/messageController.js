/* global require, module */
const supabase = require('../config/database')
const { normalizeBlockedSet, isConversationBlockedForUser } = require('../utils/blocking')

const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { data: membership, error: membershipError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('conversation_id', conversationId)
            .eq('user_id', req.user.id)
            .maybeSingle()

        if (membershipError) {
            return res.status(500).json({ error: membershipError.message })
        }

        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this conversation' })
        }

        const { data: conversationMembers, error: membersError } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', conversationId)

        if (membersError) return res.status(500).json({ error: membersError.message })

        const { data: blockedRows, error: blockedError } = await supabase
            .from('blocked_users')
            .select('blocked_id')
            .eq('blocker_id', req.user.id)

        if (blockedError) return res.status(500).json({ error: blockedError.message })

        const { data: blockedMeRows, error: blockedMeError } = await supabase
            .from('blocked_users')
            .select('blocker_id')
            .eq('blocked_id', req.user.id)

        if (blockedMeError) return res.status(500).json({ error: blockedMeError.message })

        const blockedByCurrentUser = normalizeBlockedSet(blockedRows ?? [])
        const blockedAgainstCurrentUser = normalizeBlockedSet(blockedMeRows ?? [])

        if (isConversationBlockedForUser(req.user.id, (conversationMembers ?? []).map((row) => row.user_id), blockedByCurrentUser, blockedAgainstCurrentUser)) {
            return res.status(403).json({ error: 'You cannot access messages with this user because you are blocked or have blocked them.' })
        }

        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", {
                ascending: true
            });

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        const visibleMessages = (data ?? []).filter((message) => {
            const deletedFor = Array.isArray(message.deleted_for) ? message.deleted_for : []
            return !message.deleted_for_everyone && !deletedFor.includes(req.user.id)
        })

        const senderIds = [...new Set((visibleMessages).map((message) => message.sender_id).filter(Boolean))]
        let senderMap = new Map()

        if (senderIds.length) {
            const { data: senderRows, error: senderError } = await supabase
                .from('users')
                .select('id, full_name, username, avatar_url')
                .in('id', senderIds)

            if (senderError) {
                return res.status(500).json({ error: senderError.message })
            }

            senderMap = new Map((senderRows ?? []).map((user) => [user.id, user]))
        }

        const enrichedMessages = visibleMessages.map((message) => {
            const senderUser = senderMap.get(message.sender_id)
            return {
                ...message,
                sender_name: senderUser?.full_name || senderUser?.username || message.sender_name || 'User',
                avatar_url: senderUser?.avatar_url || message.avatar_url || null,
            }
        })

        res.status(200).json(enrichedMessages);

    } catch (error) {
        console.error(error)
        res.status(500).json({
            error: "Internal server error"
        });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { conversation_id, content, attachment } = req.body;

        if (!conversation_id || (!content && !attachment)) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { data: membership, error: membershipError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('conversation_id', conversation_id)
            .eq('user_id', req.user.id)
            .maybeSingle()

        if (membershipError) return res.status(500).json({ error: membershipError.message })
        if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

        const { data: conversationMembers, error: membersError } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', conversation_id)

        if (membersError) return res.status(500).json({ error: membersError.message })

        const { data: blockedRows, error: blockedError } = await supabase
            .from('blocked_users')
            .select('blocked_id')
            .eq('blocker_id', req.user.id)

        if (blockedError) return res.status(500).json({ error: blockedError.message })

        const { data: blockedMeRows, error: blockedMeError } = await supabase
            .from('blocked_users')
            .select('blocker_id')
            .eq('blocked_id', req.user.id)

        if (blockedMeError) return res.status(500).json({ error: blockedMeError.message })

        const blockedByCurrentUser = normalizeBlockedSet(blockedRows ?? [])
        const blockedAgainstCurrentUser = normalizeBlockedSet(blockedMeRows ?? [])

        if (isConversationBlockedForUser(req.user.id, (conversationMembers ?? []).map((row) => row.user_id), blockedByCurrentUser, blockedAgainstCurrentUser)) {
            return res.status(403).json({ error: 'You cannot send a message to this user because you are blocked or have blocked them.' })
        }

        const normalizedAttachment = attachment && typeof attachment === 'object' ? attachment : null
        const messagePayload = {
            conversation_id,
            sender_id: req.user.id,
            content: content || (normalizedAttachment ? 'Shared a file' : ''),
            message_type: normalizedAttachment ? 'file' : 'text',
            attachment: normalizedAttachment,
        }

        const { data, error } = await supabase
            .from('messages')
            .insert([messagePayload])
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Internal server error" });
    }
};

const markConversationRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { data: membership, error: membershipError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('conversation_id', conversationId)
            .eq('user_id', req.user.id)
            .maybeSingle()

        if (membershipError) return res.status(500).json({ error: membershipError.message })
        if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

        const { error } = await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .neq('sender_id', req.user.id)
            .is('read_at', null)

        if (error) return res.status(500).json({ error: error.message })
        res.status(204).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Internal server error' })
    }
};

const editMessage = async (req, res) => {
    const content = req.body.content?.trim()
    if (!content) return res.status(400).json({ error: 'Message content is required' })

    const { data, error } = await supabase
        .from('messages')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', req.params.messageId)
        .eq('sender_id', req.user.id)
        .select()
        .single()

    if (error) return res.status(404).json({ error: 'Message could not be edited' })
    res.json(data)
}

const deleteMessage = async (req, res) => {
    const mode = (req.body?.mode || 'me').toLowerCase()
    const { data: message, error: selectError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', req.params.messageId)
        .maybeSingle()

    if (selectError) return res.status(500).json({ error: selectError.message })
    if (!message) return res.status(404).json({ error: 'Message not found' })

    if (mode === 'everyone') {
        if (message.sender_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own messages for everyone.' })
        }

        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', req.params.messageId)

        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ success: true, mode: 'everyone' })
    }

    const deletedFor = Array.from(new Set([...(Array.isArray(message.deleted_for) ? message.deleted_for : []), req.user.id]))
    const { error } = await supabase
        .from('messages')
        .update({
            deleted_for: deletedFor,
            updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.messageId)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, mode: 'me', deleted_for: deletedFor })
}

const togglePinMessage = async (req, res) => {
    try {
        const messageId = req.params.messageId
        const nextPinned = Boolean(req.body?.pinned)

        const { data: message, error: messageError } = await supabase
            .from('messages')
            .select('*')
            .eq('id', messageId)
            .maybeSingle()

        if (messageError) return res.status(500).json({ error: messageError.message })
        if (!message) return res.status(404).json({ error: 'Message not found' })

        const { data: membership, error: membershipError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('conversation_id', message.conversation_id)
            .eq('user_id', req.user.id)
            .maybeSingle()

        if (membershipError) return res.status(500).json({ error: membershipError.message })
        if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

        if (nextPinned) {
            const { data: pinnedMessages, error: pinnedError } = await supabase
                .from('messages')
                .select('pinned_order')
                .eq('conversation_id', message.conversation_id)
                .eq('pinned', true)
                .order('pinned_order', { ascending: true })

            if (pinnedError) return res.status(500).json({ error: pinnedError.message })

            const nextOrder = pinnedMessages.length
                ? Math.max(...pinnedMessages.map((item) => Number(item.pinned_order ?? 0))) + 1
                : 1

            const { data, error } = await supabase
                .from('messages')
                .update({
                    pinned: true,
                    pinned_order: nextOrder,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', messageId)
                .select()
                .single()

            if (error) return res.status(500).json({ error: error.message })
            return res.status(200).json(data)
        }

        const { data, error } = await supabase
            .from('messages')
            .update({
                pinned: false,
                pinned_order: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', messageId)
            .select()
            .single()

        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json(data)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

const clearConversationMessages = async (req, res) => {
    try {
        const { conversationId } = req.params

        const { data: membership, error: membershipError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('conversation_id', conversationId)
            .eq('user_id', req.user.id)
            .maybeSingle()

        if (membershipError) return res.status(500).json({ error: membershipError.message })
        if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' })

        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversationId)

        if (error) return res.status(500).json({ error: error.message })

        res.status(200).json({ success: true, conversationId })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

module.exports = { getMessages, sendMessage, markConversationRead, editMessage, deleteMessage, togglePinMessage, clearConversationMessages };