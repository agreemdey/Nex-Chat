
import { supabase } from './supabase'

const resolveApiBaseUrl = () => {
    // Allow an explicitly configured API URL if needed.
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.replace(/\/+$/, '')
    }

    // Use the Vite proxy for local and forwarded frontend URLs.
    return '/api'
}

const API_URL = resolveApiBaseUrl()

const request = async (path, token, options = {}) => {
    const { _retry, ...fetchOptions } = options
    let response

    try {
        response = await fetch(`${API_URL}${path}`, {
            ...fetchOptions,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...fetchOptions.headers,
            },
        })
    } catch {
        throw new Error(
            'Could not reach the chat server. Make sure the backend is running.'
        )
    }

    if (response.status === 401 && token && !_retry) {
        const { data, error } = await supabase.auth.refreshSession()

        if (!error && data.session?.access_token) {
            return request(path, data.session.access_token, {
                ...fetchOptions,
                _retry: true,
            })
        }
    }

    if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(
            body?.error || `Request failed with status ${response.status}`
        )
    }

    return response.json()
}

export const getUsers = (token) => request('/users', token)

export const getUserById = (userId, token) =>
    request(`/users/${encodeURIComponent(userId)}`, token)

export const searchUsers = (query, token) =>
    request(`/users/search?q=${encodeURIComponent(query)}`, token)

export const getBlockedUsers = (token) => request('/users/blocked', token)

export const blockUser = (userId, token) =>
    request(`/users/${encodeURIComponent(userId)}/block`, token, {
        method: 'POST',
    })

export const unblockUser = (userId, token) =>
    request(`/users/${encodeURIComponent(userId)}/block`, token, {
        method: 'DELETE',
    })

export const createUserProfile = (profile, token) =>
    request('/users/profile', token, {
        method: 'POST',
        body: JSON.stringify(profile),
    })

export const getChats = (token) => request('/chats', token)

export const getMessages = (conversationId, token) =>
    request(`/messages/${conversationId}`, token)

export const markConversationRead = (conversationId, token) =>
    request(`/messages/${conversationId}/read`, token, {
        method: 'PATCH',
    })

export const sendMessage = (message, token) =>
    request('/messages', token, {
        method: 'POST',
        body: JSON.stringify(message),
    })

export const createConversation = (conversation, token) =>
    request('/chats', token, {
        method: 'POST',
        body: JSON.stringify(conversation),
    })

export const renameConversation = (conversationId, name, token) =>
    request(`/chats/${conversationId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
    })

export const updateConversationState = (conversationId, state, token) =>
    request(`/chats/${conversationId}/state`, token, {
        method: 'PATCH',
        body: JSON.stringify(state),
    })

export const addConversationMembers = (conversationId, memberIds, token) =>
    request(`/chats/${conversationId}/members`, token, {
        method: 'POST',
        body: JSON.stringify({ memberIds }),
    })

export const leaveConversation = (conversationId, token) =>
    request(`/chats/${conversationId}/leave`, token, {
        method: 'DELETE',
    })

export const deleteConversation = (conversationId, token) =>
    request(`/chats/${conversationId}`, token, {
        method: 'DELETE',
    })

export const editMessage = (messageId, content, token) =>
    request(`/messages/message/${messageId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
    })

export const deleteMessage = (messageId, mode = 'me', token) =>
    request(`/messages/message/${messageId}`, token, {
        method: 'DELETE',
        body: JSON.stringify({ mode }),
    })

export const togglePinMessage = (messageId, pinned, token) =>
    request(`/messages/message/${messageId}/pin`, token, {
        method: 'PATCH',
        body: JSON.stringify({ pinned }),
    })

export const clearConversationMessages = (conversationId, token) =>
    request(`/messages/${conversationId}/clear`, token, {
        method: 'DELETE',
    })
