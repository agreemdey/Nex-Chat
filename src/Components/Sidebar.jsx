import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Context/AuthContext'
import { useChat } from '../Context/ChatContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import ContactPanel from './ContactPanel'
import ConversationDialog from './ConversationDialog'
import '../Styles/Sidebar.css'

function Sidebar() {
    const [showConversationDialog, setShowConversationDialog] = useState(false)
    const [openMenuId, setOpenMenuId] = useState(null)
    const [panelConversation, setPanelConversation] = useState(null)
    const menuRef = useRef(null)
    const navigate = useNavigate()
    const { user, logout } = useAuth()

    const {
        filteredChats,
        currentChat,
        selectChat,
        searchQuery,
        setSearchQuery,
        activeFilter,
        setActiveFilter,
        connectionStatus,
        notificationPermission,
        requestNotifications,
        toggleArchiveChat,
        togglePinChat,
        clearCurrentConversation,
        deleteCurrentConversation,
        toggleBlockUser,
        blockedUsers,
        filterCounts,
        messagesByChat,
        formatConversationTimestamp,
        getConversationPreview,
    } = useChat()

    const navItems = useMemo(() => [
        { id: 'All Inbox', label: 'All Inbox', count: filterCounts.allInbox },
        { id: 'Groups', label: 'Groups', count: filterCounts.groups },
        { id: 'Archived', label: 'Archived', count: filterCounts.archived },
    ], [filterCounts])

    useEffect(() => {
        if (openMenuId === null) return undefined

        const handlePointerDown = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuId(null)
            }
        }

        const handleEscape = (event) => {
            if (event.key === 'Escape') setOpenMenuId(null)
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [openMenuId])

    const handleLogout = async () => {
        await logout()
        navigate('/login', { replace: true })
    }

    const renderAvatar = (imageUrl, fallbackText, shouldUseDot = false) => {
        const hasImage = typeof imageUrl === 'string' && imageUrl.trim().length > 0

        if (hasImage) {
            return <img src={imageUrl} alt={fallbackText} className={shouldUseDot ? 'avatar-dot-image' : ''} />
        }

        return <span className="conversation-avatar-fallback">{fallbackText.charAt(0).toUpperCase()}</span>
    }

    const handleConversationAction = async (conversationId, action) => {
        setOpenMenuId(null)

        if (action === 'archive') {
            toggleArchiveChat(conversationId)
            return
        }

        if (action === 'pin') {
            togglePinChat(conversationId)
            return
        }

        if (action === 'clear') {
            await clearCurrentConversation(conversationId)
            return
        }

        if (action === 'delete') {
            if (window.confirm('Delete this chat?')) {
                await deleteCurrentConversation(conversationId)
            }
            return
        }

        if (action === 'block') {
            const conversation = filteredChats.find((item) => item.id === conversationId) ?? currentChat
            const otherUserId = conversation?.type === 'direct'
                ? (conversation.memberIds ?? []).find((memberId) => memberId !== user?.id) ?? null
                : null

            if (otherUserId) {
                await toggleBlockUser(otherUserId)
            }
            return
        }

        if (action === 'view-info') {
            const conversation = filteredChats.find((item) => item.id === conversationId) ?? currentChat
            if (conversation) setPanelConversation(conversation)
        }
    }

    const moveFilterFocus = (currentId, direction) => {
        const currentIndex = navItems.findIndex((item) => item.id === currentId)
        const nextIndex = (currentIndex + direction + navItems.length) % navItems.length
        const nextTab = navItems[nextIndex]
        const node = document.querySelector(`[data-filter-tab="${nextTab.id}"]`)
        if (node instanceof HTMLElement) node.focus()
        setActiveFilter(nextTab.id)
    }

    return (
        <aside className="sidebar">

            {/* Sidebar Header */}
            <div className="sidebar-header">
                <div className="brand">
                    <div className="brand-logo">n</div>

                    <div className="brand-text">
                        <h1>Nex Chat .</h1>
                        <span>Messaging</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        data-filter-tab={item.id}
                        className={`nav-item ${activeFilter === item.id ? 'active' : ''} ${item.id === 'Archived' ? 'archived-tab' : ''}`}
                        onClick={() => setActiveFilter(item.id)}
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                                event.preventDefault()
                                moveFilterFocus(item.id, 1)
                            }
                            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                                event.preventDefault()
                                moveFilterFocus(item.id, -1)
                            }
                        }}
                        aria-label={`${item.label} filter ${item.count} items`}
                    >
                        <span>{item.label}</span>
                        <span className="nav-count">{item.count}</span>
                    </button>
                ))}
            </nav>

            {/* Messages / Conversations */}
            <div className="sidebar-section">

                <div className="section-header">
                    <p className="section-label">Messages</p>
                    <button type="button" className="new-conversation-button" onClick={() => setShowConversationDialog(true)} aria-label="New conversation" title="New conversation">+</button>
                </div>

                {/* Search */}
                <label className="sidebar-search" htmlFor="chat-search">
                    <span aria-hidden="true">⌕</span>

                    <input
                        id="chat-search"
                        type="text"
                        value={searchQuery}
                        onChange={(event) =>
                            setSearchQuery(event.target.value)
                        }
                        placeholder="Search conversations"
                    />
                </label>

                {/* Existing conversations */}
                <div className="conversation-list">

                    {filteredChats.length === 0 ? (
                        <p className="empty-conversations">
                            No conversations found.
                        </p>
                    ) : (
                        filteredChats.map((conversation) => (
                            <div key={conversation.id} className="conversation-item-wrap">
                                <button
                                    type="button"
                                    className={`conversation-item ${currentChat?.id === conversation.id ? 'active' : ''}`}
                                    onClick={() => selectChat(conversation.id)}
                                >
                                    <div className="conversation-avatar-wrap">
                                        <span className="conversation-avatar">
                                            {renderAvatar(conversation.avatarUrl || conversation.avatar, conversation.name || 'User')}
                                        </span>
                                        {conversation.online && (
                                            <span className="conversation-presence" aria-label="Online" />
                                        )}
                                    </div>

                                    <div className="conversation-content">
                                        <div className="conversation-top">
                                            <div className="conversation-name-wrap">
                                                <span className="conversation-name">{conversation.name}</span>
                                                {conversation.pinned && (
                                                    <span className="conversation-pin-indicator" aria-label="Pinned conversation">📌</span>
                                                )}
                                                {conversation.archived && (
                                                    <span className="conversation-archive-badge" aria-label="Archived conversation">Archived</span>
                                                )}
                                            </div>
                                            <div className="conversation-time-wrap">
                                                <span className="conversation-time">
                                                    {formatConversationTimestamp(
                                                        [...(messagesByChat[conversation.id] ?? [])].sort((left, right) => {
                                                            const leftTime = new Date(left?.timestamp ?? left?.created_at ?? left?.time ?? 0).getTime()
                                                            const rightTime = new Date(right?.timestamp ?? right?.created_at ?? right?.time ?? 0).getTime()
                                                            return leftTime - rightTime
                                                        }).at(-1)?.timestamp ?? conversation.updated_at ?? conversation.time
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="conversation-bottom">
                                            <span className="conversation-preview">
                                                {getConversationPreview(conversation, messagesByChat[conversation.id] ?? [])}
                                            </span>
                                            {currentChat?.id !== conversation.id && conversation.unreadCount > 0 && (
                                                <span className="conversation-unread" aria-label={`${conversation.unreadCount} unread messages`}>
                                                    {conversation.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>

                                <div className="conversation-menu-wrap" ref={openMenuId === conversation.id ? menuRef : null}>
                                    <button
                                        type="button"
                                        className="conversation-menu-button"
                                        aria-label={`More options for ${conversation.name}`}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            setOpenMenuId((current) => current === conversation.id ? null : conversation.id)
                                        }}
                                    >
                                        ⋯
                                    </button>

                                    {openMenuId === conversation.id && (
                                        <div className="conversation-menu-popover" role="menu" aria-label={`${conversation.name} options`}>
                                            <button
                                                type="button"
                                                role="menuitem"
                                                aria-label={conversation.archived ? 'Unarchive conversation' : 'Archive conversation'}
                                                onClick={() => handleConversationAction(conversation.id, 'archive')}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Escape') setOpenMenuId(null)
                                                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                                        event.preventDefault()
                                                        const menuButtons = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="menuitem"]'))
                                                        const currentIndex = menuButtons.indexOf(event.currentTarget)
                                                        const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + menuButtons.length) % menuButtons.length
                                                        menuButtons[nextIndex].focus()
                                                    }
                                                }}
                                            >
                                                {conversation.archived ? 'Unarchive chat' : 'Archive chat'}
                                            </button>
                                            <button type="button" role="menuitem" aria-label={conversation.pinned ? 'Unpin conversation' : 'Pin conversation'} onClick={() => handleConversationAction(conversation.id, 'pin')} onKeyDown={(event) => {
                                                if (event.key === 'Escape') setOpenMenuId(null)
                                                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                                    event.preventDefault()
                                                    const menuButtons = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="menuitem"]'))
                                                    const currentIndex = menuButtons.indexOf(event.currentTarget)
                                                    const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + menuButtons.length) % menuButtons.length
                                                    menuButtons[nextIndex].focus()
                                                }
                                            }}>
                                                {conversation.pinned ? 'Unpin chat' : 'Pin chat'}
                                            </button>
                                            <button type="button" role="menuitem" aria-label="View conversation info" onClick={() => handleConversationAction(conversation.id, 'view-info')} onKeyDown={(event) => {
                                                if (event.key === 'Escape') setOpenMenuId(null)
                                                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                                    event.preventDefault()
                                                    const menuButtons = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="menuitem"]'))
                                                    const currentIndex = menuButtons.indexOf(event.currentTarget)
                                                    const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + menuButtons.length) % menuButtons.length
                                                    menuButtons[nextIndex].focus()
                                                }
                                            }}>
                                                Contact info
                                            </button>
                                            <button type="button" role="menuitem" aria-label="Clear conversation" onClick={() => handleConversationAction(conversation.id, 'clear')} onKeyDown={(event) => {
                                                if (event.key === 'Escape') setOpenMenuId(null)
                                                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                                    event.preventDefault()
                                                    const menuButtons = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="menuitem"]'))
                                                    const currentIndex = menuButtons.indexOf(event.currentTarget)
                                                    const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + menuButtons.length) % menuButtons.length
                                                    menuButtons[nextIndex].focus()
                                                }
                                            }}>
                                                Clear chat
                                            </button>
                                            <button type="button" role="menuitem" aria-label="Delete conversation" onClick={() => handleConversationAction(conversation.id, 'delete')} onKeyDown={(event) => {
                                                if (event.key === 'Escape') setOpenMenuId(null)
                                                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                                    event.preventDefault()
                                                    const menuButtons = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="menuitem"]'))
                                                    const currentIndex = menuButtons.indexOf(event.currentTarget)
                                                    const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + menuButtons.length) % menuButtons.length
                                                    menuButtons[nextIndex].focus()
                                                }
                                            }}>
                                                Delete chat
                                            </button>
                                            {(() => {
                                                const otherUserId = conversation.type === 'direct'
                                                    ? (conversation.memberIds ?? []).find((memberId) => memberId !== user?.id) ?? null
                                                    : null
                                                const isBlocked = otherUserId ? blockedUsers.map(String).includes(String(otherUserId)) : false

                                                return (
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        aria-label={isBlocked ? 'Unblock conversation' : 'Block conversation'}
                                                        onClick={() => handleConversationAction(conversation.id, 'block')}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Escape') setOpenMenuId(null)
                                                            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                                                event.preventDefault()
                                                                const menuButtons = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="menuitem"]'))
                                                                const currentIndex = menuButtons.indexOf(event.currentTarget)
                                                                const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + menuButtons.length) % menuButtons.length
                                                                menuButtons[nextIndex].focus()
                                                            }
                                                        }}
                                                    >
                                                        {isBlocked ? 'Unblock' : 'Block'}
                                                    </button>
                                                )
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                </div>
            </div>

            {showConversationDialog && <ConversationDialog onClose={() => setShowConversationDialog(false)} />}

            {panelConversation && (
                <ContactPanel currentChat={panelConversation} onClose={() => setPanelConversation(null)} />
            )}

            {/* Current User / Profile */}
            <div className="sidebar-footer">

                <button
                    type="button"
                    className="profile-button"
                    onClick={() => navigate('/profile')}
                >
                    <div className="profile-avatar">
                        {renderAvatar(user?.avatarUrl || user?.avatar, user?.name || user?.username || 'User')}
                    </div>

                    <div className="profile-info">
                        <span className="profile-name">
                            {user?.name || user?.full_name || user?.username || 'User'}
                        </span>

                        {user?.username && (
                            <span className="profile-username">
                                @{user.username}
                            </span>
                        )}
                    </div>
                </button>

                <button
                    type="button"
                    className="logout-button"
                    onClick={handleLogout}
                >
                    Logout
                </button>
            </div>

        </aside>
    )
}

export default Sidebar