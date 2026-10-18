/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  addConversationMembers,
  clearConversationMessages as clearConversationMessagesRequest,
  createConversation as createConversationRequest,
  deleteConversation as deleteConversationRequest,
  getChats,
  getMessages,
  editMessage as editMessageRequest,
  deleteMessage as deleteMessageRequest,
  leaveConversation as leaveConversationRequest,
  markConversationRead,
  renameConversation as renameConversationRequest,
  searchUsers as searchUsersRequest,
  sendMessage as sendMessageRequest,
  togglePinMessage as togglePinMessageRequest,
  updateConversationState,
} from '../Services/api'
import { isSupabaseConfigured, supabase } from '../Services/supabase'
import { useAuth } from './AuthContext'

const ChatContext = createContext(null)

const emptyChats = []
const emptyMessagesByChat = {}

const displayTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatConversationTimestamp = (value) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (diffMs < 48 * 60 * 60 * 1000) {
    return 'Yesterday'
  }

  return date.toLocaleDateString('en-GB')
}

const getConversationPreview = (conversation, allMessages = []) => {
  const sortedMessages = [...allMessages].sort((left, right) => {
    const leftTime = new Date(left?.timestamp ?? left?.created_at ?? left?.time ?? 0).getTime()
    const rightTime = new Date(right?.timestamp ?? right?.created_at ?? right?.time ?? 0).getTime()
    return leftTime - rightTime
  })

  const latestMessage = sortedMessages.at(-1)
  const latestText = latestMessage?.text ?? latestMessage?.content ?? ''

  if (latestText) return latestText
  if (conversation?.lastMessage || conversation?.preview) return conversation.lastMessage || conversation.preview
  return 'No messages yet'
}

const normalizeMessage = (message, userId) => {
  const senderId = message.sender_id ?? message.senderId
  const isMine = message.me ?? (senderId === userId || senderId === 'me')
  const readAt = message.read_at ?? message.readAt ?? null
  const status = message.status ?? (isMine ? (readAt ? 'read' : 'delivered') : 'sent')
  const senderName = message.sender_name ?? message.sender ?? (isMine ? 'You' : 'User')
  const avatarUrl = message.avatar_url ?? message.avatarUrl ?? message.avatar ?? null
  const pinned = Boolean(message.pinned ?? false)
  const pinnedOrder = message.pinned_order ?? message.pinnedOrder ?? null

  return {
    id: message.id,
    sender: senderName,
    senderId,
    me: isMine,
    time: displayTime(message.created_at ?? message.timestamp ?? message.time),
    timestamp: message.created_at ?? message.timestamp ?? message.time,
    status,
    readAt,
    text: message.text ?? message.content ?? '',
    avatarUrl,
    avatar: avatarUrl || (senderName || 'U').slice(0, 1).toUpperCase(),
    pinned,
    pinnedOrder,
  }
}

const mergeMessages = (existingMessages = [], incomingMessages = []) => {
  const merged = new Map()

  existingMessages.forEach((message) => {
    merged.set(message.id, message)
  })

  incomingMessages.forEach((message) => {
    const existingMessage = merged.get(message.id)
    merged.set(message.id, existingMessage ? { ...existingMessage, ...message } : message)
  })

  return [...merged.values()].sort((left, right) => {
    const leftTime = left.timestamp ?? left.time ?? 0
    const rightTime = right.timestamp ?? right.time ?? 0
    return new Date(leftTime).getTime() - new Date(rightTime).getTime()
  })
}

const getChatActivityTimestamp = (chat) => {
  const rawValue = chat?.updated_at ?? chat?.updatedAt ?? chat?.last_activity_at ?? chat?.lastActivityAt ?? chat?.time ?? 0
  const timestamp = new Date(rawValue).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

const sortChatsByActivity = (chatList = []) => [...chatList].sort((left, right) => {
  if (Number(right.pinned) !== Number(left.pinned)) return Number(right.pinned) - Number(left.pinned)
  return getChatActivityTimestamp(right) - getChatActivityTimestamp(left)
})

const normalizeChat = (chat, index) => ({
  id: chat.id,
  memberIds: (chat.conversation_members ?? []).map((member) => member.user_id),
  name: chat.name || `Conversation ${index + 1}`,
  avatar: chat.avatar_url ?? chat.avatar ?? (chat.name || 'C').slice(0, 2).toUpperCase(),
  avatarUrl: chat.avatar_url ?? chat.avatarUrl ?? null,
  accent: chat.accent || 'lavender',
  online: false,
  pinned: Boolean(chat.pinned),
  archived: Boolean(chat.archived),
  updatedAt: chat.updated_at ?? chat.updatedAt ?? null,
  lastMessage: chat.last_message || chat.lastMessage || chat.preview || '',
  preview: chat.last_message || chat.lastMessage || chat.preview || 'No messages yet',
  time: displayTime(chat.updated_at ?? chat.time),
  unreadCount: Number(chat.unread_count ?? chat.unreadCount ?? 0),
  hasMention: Boolean(chat.hasMention),
  type: chat.type || 'team',
})

const getPresenceUserIds = (presenceState = {}) => Object.entries(presenceState).flatMap(([key, entries]) =>
  (entries ?? []).map((presence) => presence.userId ?? presence.user_id ?? key).filter(Boolean)
)

const computeConversationOnline = (chat, userId, onlineUserIds = []) => {
  if (!chat?.memberIds?.length) return false

  return chat.memberIds.some((memberId) => memberId && memberId !== userId && onlineUserIds.includes(memberId))
}

const applyOnlineStateToChat = (chat, userId, onlineUserIds) => ({
  ...chat,
  online: computeConversationOnline(chat, userId, onlineUserIds),
})

export function ChatProvider({ children }) {
  const { user, accessToken } = useAuth()
  const [chats, setChats] = useState(emptyChats)
  const [currentChat, setCurrentChat] = useState(null)
  const [messagesByChat, setMessagesByChat] = useState(emptyMessagesByChat)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All Inbox')
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [chatError, setChatError] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [blockedUsers, setBlockedUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  )
  const realtimeChannelRef = useRef(null)
  const messageChannelRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const currentChatIdRef = useRef(currentChat?.id)

  useEffect(() => {
    currentChatIdRef.current = currentChat?.id
  }, [currentChat?.id])

  useEffect(() => {
    if (!isSupabaseConfigured || !accessToken || !user?.id) return undefined

    supabase.realtime.setAuth(accessToken)

    const channel = supabase
      .channel('messages:all')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, ({ new: newMessage }) => {
        const chatId = newMessage.conversation_id
        const incomingMessage = normalizeMessage(newMessage, user.id)
        const isActiveChat = currentChatIdRef.current === chatId

        setMessagesByChat((currentMessages) => {
          const messages = currentMessages[chatId] ?? []
          if (messages.some((message) => message.id === incomingMessage.id)) return currentMessages

          return { ...currentMessages, [chatId]: [...messages, incomingMessage] }
        })

        setChats((currentChats) => sortChatsByActivity(currentChats.map((chat) => (
          chat.id !== chatId
            ? chat
            : {
              ...chat,
              lastMessage: incomingMessage.text,
              preview: incomingMessage.text,
              time: incomingMessage.time,
              updatedAt: incomingMessage.timestamp ?? new Date().toISOString(),
              unreadCount: isActiveChat || incomingMessage.senderId === user.id
                ? 0
                : (chat.unreadCount ?? 0) + 1,
            }
        ))))

        if (!isActiveChat && incomingMessage.senderId !== user.id && document.hidden && notificationPermission === 'granted') {
          new Notification('New NexChat message', {
            body: incomingMessage.text || 'You have a new message.',
            tag: `nexchat-${chatId}`,
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      }, ({ new: updatedMessage }) => {
        const updated = normalizeMessage(updatedMessage, user.id)
        setMessagesByChat((currentMessages) => {
          const messages = currentMessages[updatedMessage.conversation_id] ?? []
          return {
            ...currentMessages,
            [updatedMessage.conversation_id]: messages.map((message) => (
              message.id === updated.id ? { ...message, ...updated } : message
            )),
          }
        })
      })

    messageChannelRef.current = channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setConnectionStatus('connected')
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnectionStatus('reconnecting')
      if (status === 'CLOSED') setConnectionStatus('disconnected')
    })

    return () => {
      if (messageChannelRef.current === channel) messageChannelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [accessToken, notificationPermission, user?.id])

  useEffect(() => {
    if (!isSupabaseConfigured || !accessToken || !user?.id) return undefined

    const channel = supabase
      .channel('presence:nexchat', { config: { presence: { key: user.id } } })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const uniqueUsers = [...new Set(getPresenceUserIds(state))]

        setOnlineUsers(uniqueUsers)
        setChats((currentChats) => currentChats.map((chat) => applyOnlineStateToChat(chat, user.id, uniqueUsers)))
        setCurrentChat((chat) => (chat ? applyOnlineStateToChat(chat, user.id, uniqueUsers) : chat))
      })

    presenceChannelRef.current = channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: user.id, user_id: user.id, email: user.email ?? null, online: true, last_seen_at: new Date().toISOString() })
        const state = channel.presenceState()
        const uniqueUsers = [...new Set(getPresenceUserIds(state))]
        setOnlineUsers(uniqueUsers)
        setChats((currentChats) => currentChats.map((chat) => applyOnlineStateToChat(chat, user.id, uniqueUsers)))
        setCurrentChat((chat) => (chat ? applyOnlineStateToChat(chat, user.id, uniqueUsers) : chat))
      }
    })

    const handleOffline = () => setConnectionStatus('disconnected')
    const handleOnline = () => {
      setConnectionStatus('reconnecting')
      channel.subscribe()
      messageChannelRef.current?.subscribe()
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      setOnlineUsers([])
      if (presenceChannelRef.current === channel) presenceChannelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [accessToken, user?.id])

  useEffect(() => {
    if (!isSupabaseConfigured || !accessToken || !currentChat?.id) return undefined

    const channel = supabase
      .channel(`conversation:${currentChat.id}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.userId || payload.userId === user?.id) return

        setTypingUsers((currentUsers) => {
          const nextUsers = currentUsers.filter((entry) => {
            const typingUserId = typeof entry === 'string' ? entry : entry?.userId
            return typingUserId !== payload.userId
          })

          if (!payload.isTyping) return nextUsers

          return [
            ...nextUsers,
            {
              userId: payload.userId,
              displayName: payload.displayName || payload.username || payload.name || 'User',
            },
          ]
        })
      })
      .on('broadcast', { event: 'read' }, ({ payload }) => {
        if (!payload?.userId || payload.userId === user?.id) return

        setMessagesByChat((currentMessages) => ({
          ...currentMessages,
          [currentChat.id]: (currentMessages[currentChat.id] ?? []).map((message) => (
            message.senderId === user.id && message.me ? { ...message, status: 'read', readAt: payload.readAt } : message
          )),
        }))
      })

    realtimeChannelRef.current = channel
    supabase.realtime.setAuth(accessToken)
    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      const readAt = new Date().toISOString()
      await markConversationRead(currentChat.id, accessToken).catch(() => {})
      await channel.send({
        type: 'broadcast',
        event: 'read',
        payload: { userId: user?.id, readAt },
      })
    })

    const refreshMessages = async () => {
      try {
        const remoteMessages = await getMessages(currentChat.id, accessToken)
        const normalizedRemoteMessages = remoteMessages.map((message) => normalizeMessage(message, user?.id))

        setMessagesByChat((currentMessages) => ({
          ...currentMessages,
          [currentChat.id]: mergeMessages(currentMessages[currentChat.id] ?? [], normalizedRemoteMessages),
        }))
      } catch {
        // Realtime remains the primary path; keep the current messages during a temporary API failure.
      }
    }
    const refreshTimer = window.setInterval(refreshMessages, 5000)

    return () => {
      if (realtimeChannelRef.current === channel) realtimeChannelRef.current = null
      setTypingUsers([])
      window.clearInterval(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [accessToken, currentChat?.id, user?.id])

  const refreshChats = useCallback(async () => {
    if (!accessToken) return
    setLoadingChats(true)

    try {
      const remoteChats = await getChats(accessToken)
      const apiChats = remoteChats.map(normalizeChat)
      const nextChats = sortChatsByActivity(apiChats.map((chat) => applyOnlineStateToChat(chat, user?.id, onlineUsers)))
      setChats(nextChats)
      setCurrentChat((currentChatValue) => {
        if (!currentChatValue) return null
        const refreshed = nextChats.find((chat) => chat.id === currentChatValue.id)
        return refreshed ? applyOnlineStateToChat(refreshed, user?.id, onlineUsers) : null
      })
    } catch {
      setChatError('Could not refresh your conversations.')
    } finally {
      setLoadingChats(false)
    }
  }, [accessToken, onlineUsers, user?.id])

  useEffect(() => {
    if (!isSupabaseConfigured || !accessToken || !user?.id) return undefined

    const membershipChannel = supabase
      .channel(`conversation-memberships:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_members',
        filter: `user_id=eq.${user.id}`,
      }, refreshChats)

    membershipChannel.subscribe()
    window.addEventListener('focus', refreshChats)
    const refreshTimer = window.setTimeout(refreshChats, 0)

    return () => {
      window.clearTimeout(refreshTimer)
      window.removeEventListener('focus', refreshChats)
      supabase.removeChannel(membershipChannel)
    }
  }, [accessToken, refreshChats, user?.id])

  const messages = currentChat ? messagesByChat[currentChat.id] ?? [] : []

  const filterCounts = useMemo(() => {
    const archivedCount = chats.filter((chat) => chat.archived).length
    const allInboxCount = chats.filter((chat) => !chat.archived).length
    const groupsCount = chats.filter((chat) => !chat.archived && (chat.type === 'group' || chat.type === 'team')).length
    const unreadCount = chats.filter((chat) => !chat.archived && (chat.unreadCount ?? 0) > 0).length

    return {
      allInbox: allInboxCount,
      groups: groupsCount,
      archived: archivedCount,
      unread: unreadCount,
    }
  }, [chats])

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const categoryChats = activeFilter === 'Groups'
      ? chats.filter((chat) => !chat.archived && (chat.type === 'group' || chat.type === 'team'))
      : activeFilter === 'Archived'
        ? chats.filter((chat) => chat.archived)
        : activeFilter === 'Mentions'
          ? chats.filter((chat) => !chat.archived && chat.hasMention)
          : activeFilter === 'All Inbox' || activeFilter === 'Inbox'
            ? chats.filter((chat) => !chat.archived)
            : chats.filter((chat) => !chat.archived)

    const sortedChats = sortChatsByActivity(categoryChats)

    if (!query) return sortedChats

    return sortedChats.filter((chat) =>
      `${chat.name} ${chat.lastMessage}`.toLowerCase().includes(query)
    )
  }, [activeFilter, chats, searchQuery])

  const selectChat = (chatOrId) => {
    const chat = typeof chatOrId === 'object'
      ? chatOrId
      : chats.find((item) => item.id === chatOrId)

    if (!chat) return

    if (typeof window !== 'undefined' && window.location.pathname === '/chat') {
      const nextState = { chatOpen: true }
      const currentState = window.history.state
      if (!currentState || currentState.chatOpen !== true) {
        window.history.pushState(nextState, '', '/chat')
      }
    }

    setLoadingMessages(true)
    setChatError(null)
    setCurrentChat(chat)
    setChats((currentChats) => currentChats.map((item) => (
      item.id === chat.id ? { ...item, unreadCount: 0 } : item
    )))
    markChatAsRead(chat.id)
    getMessages(chat.id, accessToken)
      .then((remoteMessages) => {
        const normalizedRemoteMessages = remoteMessages.map((message) => normalizeMessage(message, user?.id))
        setMessagesByChat((currentMessages) => ({
          ...currentMessages,
          [chat.id]: mergeMessages(currentMessages[chat.id] ?? [], normalizedRemoteMessages),
        }))
      })
      .catch(() => {
        setChatError('Could not load messages. Showing local messages.')
      })
      .finally(() => setLoadingMessages(false))
  }

  const refreshMessagesForConversation = useCallback(async (conversationId) => {
    if (!conversationId || !accessToken) return

    try {
      const remoteMessages = await getMessages(conversationId, accessToken)
      const normalizedRemoteMessages = remoteMessages.map((message) => normalizeMessage(message, user?.id))

      setMessagesByChat((currentMessages) => ({
        ...currentMessages,
        [conversationId]: mergeMessages(currentMessages[conversationId] ?? [], normalizedRemoteMessages),
      }))
    } catch {
      // Keep the current message state if the refresh fails. The next poll or realtime event will retry.
    }
  }, [accessToken, user?.id])

  const sendMessage = (text, attachment = null) => {
    const trimmedText = text.trim()
    if ((!trimmedText && !attachment) || !currentChat) return

    setSendingMessage(true)
    setChatError(null)

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const message = {
      id: Date.now(),
      sender: 'You',
      senderId: 'me',
      me: true,
      time: timestamp,
      timestamp,
      status: 'delivered',
      text: trimmedText || (attachment ? 'Shared a file' : ''),
      attachment,
      reactions: {},
    }

    const payload = {
      conversation_id: currentChat.id,
      content: trimmedText || (attachment ? 'Shared a file' : ''),
    }

    sendMessageRequest(payload, accessToken)
      .then(async (savedMessage) => {
        const normalizedSavedMessage = normalizeMessage(savedMessage, user?.id)
        await refreshMessagesForConversation(currentChat.id)
        return normalizedSavedMessage
      })
      .catch(() => {
        setChatError('Message could not be saved. It is shown locally for now.')
        return message
      })
      .then((messageToAdd) => {
        const nextMessage = {
          ...messageToAdd,
          attachment: attachment ?? messageToAdd.attachment ?? null,
          reactions: messageToAdd.reactions ?? {},
        }

        setMessagesByChat((currentMessages) => ({
          ...currentMessages,
          [currentChat.id]: (currentMessages[currentChat.id] ?? []).some((message) => message.id === nextMessage.id)
            ? mergeMessages(currentMessages[currentChat.id] ?? [], [nextMessage])
            : [...(currentMessages[currentChat.id] ?? []), nextMessage],
        }))
        setChats((currentChats) => sortChatsByActivity(currentChats.map((chat) => (
          chat.id === currentChat.id
            ? { ...chat, lastMessage: trimmedText || 'Shared a file', preview: trimmedText || 'Shared a file', time: timestamp, updatedAt: new Date().toISOString() }
            : chat
        ))))
      })
      .finally(() => setSendingMessage(false))
  }

  const sendTyping = (isTyping) => {
    if (!user?.id || !currentChat?.id) return

    const channel = realtimeChannelRef.current ?? messageChannelRef.current
    if (!channel) return

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        isTyping,
        displayName: user.name || user.username || 'User',
        username: user.username || user.name || 'User',
        name: user.name || user.username || 'User',
      },
    }).catch(() => {})
  }

  const toggleReaction = (messageId, emoji) => {
    if (!currentChat || !user?.id) return

    setMessagesByChat((currentMessages) => ({
      ...currentMessages,
      [currentChat.id]: (currentMessages[currentChat.id] ?? []).map((message) => {
        if (message.id !== messageId) return message

        const existingReactions = message.reactions ?? {}
        const currentUsers = existingReactions[emoji] ?? []
        const hasReacted = currentUsers.includes(user.id)

        return {
          ...message,
          reactions: {
            ...existingReactions,
            [emoji]: hasReacted
              ? currentUsers.filter((id) => id !== user.id)
              : [...currentUsers, user.id],
          },
        }
      }),
    }))
  }

  const editMessage = async (messageId, content) => {
    const updated = normalizeMessage(await editMessageRequest(messageId, content, accessToken), user?.id)
    setMessagesByChat((currentMessages) => ({
      ...currentMessages,
      [currentChat?.id]: (currentMessages[currentChat?.id] ?? []).map((message) => message.id === messageId ? { ...message, ...updated } : message),
    }))
  }

  const togglePinMessage = async (messageId) => {
    if (!currentChat?.id) return

    const currentMessage = (messagesByChat[currentChat.id] ?? []).find((message) => message.id === messageId)
    const nextPinned = !Boolean(currentMessage?.pinned)

    try {
      const updated = normalizeMessage(await togglePinMessageRequest(messageId, nextPinned, accessToken), user?.id)
      setMessagesByChat((currentMessages) => ({
        ...currentMessages,
        [currentChat.id]: (currentMessages[currentChat.id] ?? []).map((message) => (
          message.id === messageId
            ? { ...message, ...updated, pinned: nextPinned, pinnedOrder: updated.pinnedOrder ?? message.pinnedOrder ?? null }
            : message
        )).sort((left, right) => {
          if (left.pinned && !right.pinned) return -1
          if (!left.pinned && right.pinned) return 1
          if (!left.pinned && !right.pinned) return 0
          const leftOrder = Number(left.pinnedOrder ?? 0)
          const rightOrder = Number(right.pinnedOrder ?? 0)
          return leftOrder - rightOrder
        }),
      }))
    } catch (error) {
      console.error('Failed to update pin state:', error)
    }
  }

  const deleteMessage = async (messageId, mode = 'me') => {
    await deleteMessageRequest(messageId, mode, accessToken)

    setMessagesByChat((currentMessages) => ({
      ...currentMessages,
      [currentChat?.id]: (currentMessages[currentChat?.id] ?? []).filter((message) => message.id !== messageId),
    }))

    if (mode === 'everyone') {
      setChats((currentChats) => currentChats.map((chat) => {
        if (chat.id !== currentChat?.id) return chat
        const remainingMessages = messagesByChat[currentChat?.id] ?? []
        const lastMessage = remainingMessages.filter((message) => message.id !== messageId).at(-1)

        return {
          ...chat,
          lastMessage: lastMessage?.text || 'Chat cleared',
          preview: lastMessage?.text || 'Chat cleared',
          time: lastMessage ? displayTime(lastMessage.timestamp) : 'now',
        }
      }))
    }
  }

  const getFreshAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) {
      throw new Error('Your session has expired. Please log in again.')
    }
    return data.session.access_token
  }

  const createConversation = async (conversation) => {
    const created = await createConversationRequest(conversation, await getFreshAccessToken())
    const nextChat = normalizeChat(created, chats.length)
    setChats((currentChats) => {
      const existing = currentChats.find((chat) => chat.id === nextChat.id)
      return existing ? currentChats.map((chat) => chat.id === nextChat.id ? nextChat : chat) : [...currentChats, nextChat]
    })
    setCurrentChat(nextChat)
    return nextChat
  }

  const searchUsers = async (query) => searchUsersRequest(query, await getFreshAccessToken())

  const renameCurrentConversation = async (conversationId, name) => {
    const updated = await renameConversationRequest(conversationId, name, accessToken)
    setChats((currentChats) => currentChats.map((chat) => chat.id === conversationId ? { ...chat, ...updated } : chat))
    setCurrentChat((chat) => chat?.id === conversationId ? { ...chat, ...updated } : chat)
    return updated
  }

  const addMembersToConversation = (conversationId, memberIds) => addConversationMembers(conversationId, memberIds, accessToken)

  const leaveCurrentConversation = async (conversationId) => {
    await leaveConversationRequest(conversationId, accessToken)
    setChats((currentChats) => currentChats.filter((chat) => chat.id !== conversationId))
    setCurrentChat((chat) => chat?.id === conversationId ? null : chat)
  }

  const deleteCurrentConversation = async (conversationId) => {
    await deleteConversationRequest(conversationId, accessToken)
    setChats((currentChats) => currentChats.filter((chat) => chat.id !== conversationId))
    setMessagesByChat((currentMessages) => {
      const nextMessages = { ...currentMessages }
      delete nextMessages[conversationId]
      return nextMessages
    })
    setCurrentChat((chat) => chat?.id === conversationId ? null : chat)
  }

  const receiveMessage = (message) => {
    if (!currentChat) return

    const chatId = message.chatId ?? currentChat.id
    setMessagesByChat((currentMessages) => ({
      ...currentMessages,
      [chatId]: [...(currentMessages[chatId] ?? []), message],
    }))
  }

  const toggleBlockUser = (userId) => {
    if (!userId) return

    setBlockedUsers((currentUsers) => (
      currentUsers.includes(userId)
        ? currentUsers.filter((id) => id !== userId)
        : [...currentUsers, userId]
    ))
  }

  const clearCurrentConversation = async (conversationId = currentChat?.id) => {
    if (!conversationId) return

    try {
      await clearConversationMessagesRequest(conversationId, accessToken)
    } catch (error) {
      console.error('Failed to clear conversation messages:', error)
    }

    setMessagesByChat((currentMessages) => ({
      ...currentMessages,
      [conversationId]: [],
    }))

    setChats((currentChats) => currentChats.map((chat) => (
      chat.id === conversationId
        ? { ...chat, lastMessage: 'Chat cleared', preview: 'Chat cleared', time: 'now', unreadCount: 0 }
        : chat
    )))

    if (currentChat?.id === conversationId) {
      setCurrentChat((chat) => (chat ? {
        ...chat,
        lastMessage: 'Chat cleared',
        preview: 'Chat cleared',
        time: 'now',
        unreadCount: 0,
      } : chat))
    }
  }

  const togglePinChat = async (conversationId) => {
    if (!conversationId) return

    const currentConversation = chats.find((chat) => chat.id === conversationId)
    const nextPinned = !Boolean(currentConversation?.pinned)

    try {
      const updated = await updateConversationState(conversationId, { pinned: nextPinned }, accessToken)
      const nextChat = normalizeChat({ ...currentConversation, ...updated }, 0)

      setChats((currentChats) => sortChatsByActivity(currentChats.map((chat) => (
        chat.id === conversationId ? { ...chat, ...nextChat, pinned: nextPinned } : chat
      ))))

      if (currentChat?.id === conversationId) {
        setCurrentChat((chat) => (chat ? { ...chat, ...nextChat, pinned: nextPinned } : chat))
      }
    } catch (error) {
      console.error('Failed to persist pin state:', error)
      setChatError('Could not save the pinned state.')
    }
  }

  const toggleArchiveChat = async (conversationId) => {
    if (!conversationId) return

    const currentConversation = chats.find((chat) => chat.id === conversationId)
    const nextArchived = !Boolean(currentConversation?.archived)

    try {
      const updated = await updateConversationState(conversationId, { archived: nextArchived }, accessToken)
      const nextChat = normalizeChat({ ...currentConversation, ...updated }, 0)

      setChats((currentChats) => currentChats.map((chat) => (
        chat.id === conversationId ? { ...chat, ...nextChat, archived: nextArchived } : chat
      )))

      if (currentChat?.id === conversationId) {
        setCurrentChat((chat) => (chat ? { ...chat, ...nextChat, archived: nextArchived } : chat))
      }
    } catch (error) {
      console.error('Failed to persist archive state:', error)
      setChatError('Could not save the archive state.')
    }
  }

  const markChatAsRead = (chatId) => {
    const readAt = new Date().toISOString()
    setChats((currentChats) => currentChats.map((chat) => (
      chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    )))
    setMessagesByChat((currentMessages) => ({
      ...currentMessages,
      [chatId]: (currentMessages[chatId] ?? []).map((message) => (
        message.senderId !== user?.id && !message.readAt ? { ...message, status: 'read', readAt } : message
      )),
    }))

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'read',
        payload: { userId: user?.id, readAt },
      }).catch(() => {})
    }

    return markConversationRead(chatId, accessToken).catch(() => {})
  }

  const getUnreadCount = (chatId) => chats.find((chat) => chat.id === chatId)?.unreadCount ?? 0
  const isUserOnline = (userId) => onlineUsers.includes(userId)
  const isConversationOnline = (chat) => (chat?.memberIds ?? []).some((memberId) => onlineUsers.includes(memberId))
  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return 'unsupported'
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    return permission
  }

  const value = {
    chats,
    setChats,
    currentChat,
    setCurrentChat,
    messages,
    loadingChats,
    loadingMessages,
    sendingMessage,
    chatError,
    connectionStatus,
    notificationPermission,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    filteredChats,
    onlineUsers,
    blockedUsers,
    setOnlineUsers,
    typingUsers,
    setTypingUsers,
    selectChat,
    sendMessage,
    sendTyping,
    toggleReaction,
    editMessage,
    togglePinMessage,
    deleteMessage,
    createConversation,
    searchUsers,
    renameCurrentConversation,
    addMembersToConversation,
    leaveCurrentConversation,
    deleteCurrentConversation,
    receiveMessage,
    markChatAsRead,
    clearCurrentConversation,
    togglePinChat,
    toggleArchiveChat,
    requestNotifications,
    getUnreadCount,
    isUserOnline,
    isConversationOnline,
    toggleBlockUser,
    filterCounts,
    messagesByChat,
    formatConversationTimestamp,
    getConversationPreview,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) throw new Error('useChat must be used inside ChatProvider')
  return context
}
