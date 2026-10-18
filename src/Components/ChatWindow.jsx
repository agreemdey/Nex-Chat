import { Fragment, useEffect, useRef, useState } from 'react'
import { useAuth } from '../Context/AuthContext'
import { useChat } from '../Context/ChatContext'
import '../Styles/ChatWindow.css'
import ContactPanel from './ContactPanel'
import ConversationDialog from './ConversationDialog'
import Message from './Message'
import MessageInput from './MessageInput'

const normalizeDateKey = (value) => {
    const date = new Date(value ?? 0)
    if (Number.isNaN(date.getTime())) return null
    const normalized = new Date(date)
    normalized.setHours(0, 0, 0, 0)
    return normalized.getTime()
}

const formatDateDivider = (value) => {
    const date = new Date(value ?? 0)
    if (Number.isNaN(date.getTime())) return ''

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const target = new Date(date)
    target.setHours(0, 0, 0, 0)

    const differenceInDays = Math.round((today.getTime() - target.getTime()) / 86400000)

    if (differenceInDays === 0) return 'Today'
    if (differenceInDays === 1) return 'Yesterday'

    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
    }).format(date)
}

function ChatWindow() {
    const { user } = useAuth()
    const {
        currentChat,
        messages,
        loadingMessages,
        chatError,
        typingUsers,
        connectionStatus,
        deleteCurrentConversation,
        editMessage,
        deleteMessage,
        toggleReaction,
        togglePinMessage,
        clearCurrentConversation,
        toggleBlockUser,
        blockedUsers,
        isUserOnline,
        isConversationOnline,
        markChatAsRead,
    } = useChat()
    const messageAreaRef = useRef(null)
    const conversationMenuRef = useRef(null)
    const [showConversationMenu, setShowConversationMenu] = useState(false)
    const [showQuickStartDialog, setShowQuickStartDialog] = useState(false)
    const [showContactPanel, setShowContactPanel] = useState(false)
    const [replyTarget, setReplyTarget] = useState(null)
    const [showPinnedStack, setShowPinnedStack] = useState(false)
    const pinnedMessages = [...messages]
        .filter((message) => message.pinned)
        .sort((left, right) => Number(left.pinnedOrder ?? 0) - Number(right.pinnedOrder ?? 0))
    const pinnedCount = pinnedMessages.length
    const messageRefs = useRef({})

    const scrollToMessage = (messageId) => {
        const target = messageRefs.current[messageId]
        if (!target) return

        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.classList.add('message-highlighted')
        window.setTimeout(() => target.classList.remove('message-highlighted'), 1400)
    }

    useEffect(() => {
        setShowConversationMenu(false)
    }, [currentChat?.id])

    useEffect(() => {
        if (!showConversationMenu) return undefined

        const handlePointerDown = (event) => {
            if (conversationMenuRef.current && !conversationMenuRef.current.contains(event.target)) {
                setShowConversationMenu(false)
            }
        }

        const handleEscape = (event) => {
            if (event.key === 'Escape') setShowConversationMenu(false)
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [showConversationMenu])

    useEffect(() => {
        const messageArea = messageAreaRef.current
        if (!messageArea) return

        messageArea.scrollTo({
            top: messageArea.scrollHeight,
            behavior: 'smooth',
        })
    }, [currentChat?.id, messages.length])

    if (!currentChat) {
        return (
            <section className="chat-window-panel chat-empty-shell">
                <div className="chat-empty-state">
                    <div className="chat-empty-icon">n</div>
                    <p className="chat-empty-eyebrow">Welcome to NexChat</p>
                    <h2>Start a private conversation in seconds</h2>
                    <p>
                        Chat directly with someone from their personal account, keep your messages organized,
                        and pick up right where you left off.
                    </p>

                    <div className="chat-empty-features">
                        <span>Fast direct chats</span>
                        <span>Encrypted feel</span>
                        <span>Organized threads</span>
                    </div>
                </div>

                {showQuickStartDialog && (
                    <ConversationDialog onClose={() => setShowQuickStartDialog(false)} />
                )}
            </section>
        )
    }

    const handleDelete = async () => {
        if (!window.confirm('Delete this conversation for everyone?')) return
        await deleteCurrentConversation(currentChat.id)
        setShowConversationMenu(false)
    }

    const otherMemberId = (currentChat.memberIds ?? []).find((memberId) => memberId !== user?.id) ?? null
    const headerIsOnline = currentChat.type === 'direct'
        ? (otherMemberId ? isUserOnline(otherMemberId) : Boolean(currentChat.online))
        : isConversationOnline(currentChat)

    const presenceText = connectionStatus !== 'connected'
        ? 'Reconnecting...'
        : headerIsOnline
            ? 'Online now'
            : 'Offline'

    const isBlocked = otherMemberId ? blockedUsers.includes(otherMemberId) : false
    const typingNames = typingUsers.map((entry) => {
        if (typeof entry === 'string') return entry
        return entry?.displayName || entry?.username || entry?.name || 'User'
    }).filter(Boolean)
    const typingLabel = typingNames.length === 0
        ? ''
        : typingNames.length === 1
            ? `${typingNames[0]} is typing...`
            : `${typingNames.slice(0, -1).join(', ')} and ${typingNames[typingNames.length - 1]} are typing...`

    const handleContactInfo = () => {
        setShowContactPanel(true)
        setShowConversationMenu(false)
    }

    const handleClearChat = () => {
        clearCurrentConversation(currentChat.id)
        setShowConversationMenu(false)
    }

    const handleBlock = () => {
        if (otherMemberId) toggleBlockUser(otherMemberId)
        setShowConversationMenu(false)
    }

    return (
        <section className="chat-window-panel">
            <header className="chat-window-header">
                <div className="chat-user-summary">
                    <button type="button" className="chat-user-avatar-wrap" onClick={() => setShowContactPanel(true)} aria-label="Open contact details">
                        {typeof currentChat.avatar === 'string' && /^(https?:\/\/|data:|\/)/.test(currentChat.avatar) ? (
                            <img className="chat-user-avatar" src={currentChat.avatar} alt={currentChat.name} />
                        ) : (
                            <span className={`chat-user-avatar ${currentChat.accent}`}>{currentChat.avatar || currentChat.name?.slice(0, 1).toUpperCase() || 'U'}</span>
                        )}
                        <span className={`chat-online-dot ${headerIsOnline ? 'online' : 'offline'}`} aria-label={headerIsOnline ? 'Online' : 'Offline'} />
                    </button>

                    <div>
                        <h3>{currentChat.name}</h3>
                        <p>{presenceText}</p>
                    </div>
                </div>

                <div className="chat-window-actions">
                    <div className="conversation-menu-wrap" ref={conversationMenuRef}>
                        <button type="button" aria-label="More options" aria-expanded={showConversationMenu} onClick={() => setShowConversationMenu((isOpen) => !isOpen)}>⋯</button>
                        {showConversationMenu && (
                            <div className="conversation-menu">
                                <button type="button" onClick={handleContactInfo}>Contact info</button>
                                <button type="button" onClick={handleClearChat}>Clear chat</button>
                                <button type="button" onClick={handleDelete}>Delete chat</button>
                                <button type="button" onClick={handleBlock}>{isBlocked ? 'Unblock' : 'Block'}</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div ref={messageAreaRef} className="chat-message-area">
                {pinnedCount > 0 && (
                    <div className={`pinned-conversation-banner ${showPinnedStack ? 'expanded' : ''}`} aria-label="Pinned messages">
                        <button type="button" className="pinned-banner-trigger" onClick={() => setShowPinnedStack((isOpen) => !isOpen)}>
                            <span className="pinned-badge">📌 {pinnedCount}</span>
                            <div className="pinned-banner-content">
                                <strong>{pinnedCount === 1 ? 'Pinned message' : `${pinnedCount} pinned messages`}</strong>
                                <span>{pinnedCount === 1 ? pinnedMessages[0].text : 'Tap to view all pinned messages'}</span>
                            </div>
                            <span className="pinned-banner-caret" aria-hidden="true">{showPinnedStack ? '▾' : '▸'}</span>
                        </button>

                        {showPinnedStack && (
                            <div className="pinned-banner-stack" aria-live="polite">
                                {pinnedMessages.map((message) => (
                                    <button
                                        key={message.id}
                                        type="button"
                                        className="pinned-message-card"
                                        onClick={() => {
                                            setShowPinnedStack(false)
                                            scrollToMessage(message.id)
                                        }}
                                    >
                                        <span className="pinned-card-meta">{message.sender}</span>
                                        <span className="pinned-card-text">{message.text}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {loadingMessages && <p>Loading messages...</p>}
                {chatError && <p>{chatError}</p>}
                {!loadingMessages && messages.map((message, index) => {
                    const previousMessage = messages[index - 1]
                    const currentDateKey = normalizeDateKey(message.timestamp ?? message.created_at ?? message.time)
                    const previousDateKey = previousMessage ? normalizeDateKey(previousMessage.timestamp ?? previousMessage.created_at ?? previousMessage.time) : null
                    const showDateDivider = !previousDateKey || currentDateKey !== previousDateKey

                    return (
                        <Fragment key={message.id}>
                            {showDateDivider && (
                                <div className="date-divider" aria-label={`Messages from ${formatDateDivider(message.timestamp ?? message.created_at ?? message.time)}`}>
                                    <span>{formatDateDivider(message.timestamp ?? message.created_at ?? message.time)}</span>
                                </div>
                            )}

                            <Message
                                sender={message.sender}
                                id={message.id}
                                text={message.text}
                                time={message.time}
                                status={message.status || (message.me ? 'delivered' : 'read')}
                                readAt={message.readAt}
                                me={message.me}
                                avatar={message.avatar || message.sender?.slice(0, 1)}
                                attachment={message.attachment}
                                reactions={message.reactions || {}}
                                onEdit={editMessage}
                                onDelete={deleteMessage}
                                onReact={toggleReaction}
                                pinned={Boolean(message.pinned)}
                                onPin={togglePinMessage}
                                onVisible={(id) => {
                                    if (currentChat && !message.readAt && message.senderId !== user?.id) {
                                        markChatAsRead(currentChat.id)
                                    }
                                }}
                                onReply={(messageId) => setReplyTarget({
                                    id: messageId,
                                    sender: message.sender,
                                    text: message.text,
                                })}
                                messageRef={(node) => {
                                    if (node) {
                                        messageRefs.current[message.id] = node
                                    }
                                }}
                            />
                        </Fragment>
                    )
                })}
                {typingLabel && <p className="typing-indicator">{typingLabel}</p>}
            </div>

            <div className="chat-composer">
                <MessageInput replyTo={replyTarget} onCancelReply={() => setReplyTarget(null)} />
            </div>

            {showContactPanel && (
                <ContactPanel currentChat={currentChat} onClose={() => setShowContactPanel(false)} />
            )}
        </section>
    )
}

export default ChatWindow
