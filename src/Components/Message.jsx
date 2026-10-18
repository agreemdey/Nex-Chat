import { useEffect, useState, useRef, useCallback } from 'react'

function Message({ sender, text, time, status = 'delivered', me = false, avatar, readAt, onEdit, onDelete, id, attachment, reactions = {}, onReact, onReply, onPin, pinned = false, messageRef = null, onVisible }) {
  const reactionOptions = ['👍', '🎉', '❤️', '🔥']
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  const divRef = useRef(null)
  
  // Combine custom ref and passed messageRef
  const setRef = useCallback((node) => {
    divRef.current = node
    if (messageRef) messageRef(node)
  }, [messageRef])

  useEffect(() => {
      if (me || readAt || !onVisible) return

      const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  onVisible(id)
              }
          })
      }, { threshold: 0.5 })

      if (divRef.current) {
          observer.observe(divRef.current)
      }

      return () => {
          if (divRef.current) {
              observer.unobserve(divRef.current)
          }
      }
  }, [me, readAt, onVisible, id])

  useEffect(() => {
    if (!showMenu) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.message-menu')) return
      setShowMenu(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowMenu(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showMenu])

  const formatStatusTime = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const statusMeta = (() => {
    if (!me) return null

    if (status === 'read') {
      if (!readAt) {
        return {
          label: 'Delivered',
          icon: '',
          className: 'status-delivered',
        }
      }

      const seenAt = formatStatusTime(readAt)
      return {
        label: seenAt ? `Seen at ${seenAt}` : 'Seen',
        icon: '',
        className: 'status-read',
      }
    }

    if (status === 'delivered') {
      return {
        label: 'Delivered',
        icon: '',
        className: 'status-delivered',
      }
    }

    return {
      label: 'Sent',
      icon: '',
      className: 'status-sent',
    }
  })()

  const handleReply = () => {
    setShowMenu(false)
    if (onReply) return onReply(id)
    window.alert('Reply action is ready to hook into the composer.')
  }

  const handlePin = () => {
    setShowMenu(false)
    if (onPin) return onPin(id)
    window.alert(pinned ? 'Message unpinned.' : 'Message pinned.')
  }

  const handleEdit = () => {
    setShowMenu(false)
    if (onEdit) {
      const nextText = window.prompt('Edit message', text)
      if (nextText?.trim() && nextText.trim() !== text) onEdit(id, nextText)
      return
    }
    window.alert('Edit action not available for this message.')
  }

  const handleDelete = () => {
    setShowMenu(false)
    if (!onDelete) {
      window.alert('Delete action not available for this message.')
      return
    }

    setShowDeleteOptions(true)
  }

  const handleDeleteChoice = (mode) => {
    setShowDeleteOptions(false)
    onDelete?.(id, mode)
  }

  const canDeleteEveryone = !!me

  const menuItems = [
    { label: 'Reply', action: handleReply },
    { label: pinned ? 'Unpin' : 'Pin', action: handlePin },
    ...(me ? [{ label: 'Edit', action: handleEdit }] : []),
    { label: 'Delete', action: handleDelete },
  ]

  const hasImageAvatar = typeof avatar === 'string' && /^(https?:\/\/|data:|\/)/.test(avatar)

  return (
    <div ref={setRef} className={`message-row ${me ? 'sent' : 'received'}`}>
      {!me && (
        hasImageAvatar ? (
          <img className="message-avatar" src={avatar} alt={sender || 'User'} />
        ) : (
          <span className="message-avatar">{avatar || sender?.slice(0, 1) || 'U'}</span>
        )
      )}

      <div className="message-card">
        <div className={`message-bubble ${pinned ? 'pinned' : ''}`}>
          {pinned && <div className="message-pin-indicator">📌 Pinned</div>}

          <div className="message-meta">
            <strong>{sender}</strong>
            <time>{time}</time>
          </div>

          {attachment && (
            <div className="message-attachment">
              {attachment.type?.startsWith('image/') || attachment.url?.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? (
                <img src={attachment.url} alt={attachment.name || 'Shared image'} />
              ) : (
                <div className="message-file-card">
                  <span>📎</span>
                  <div>
                    <strong>{attachment.name || 'Shared file'}</strong>
                    <small>{attachment.size ? `${Math.max(1, Math.round(attachment.size / 1024))} KB` : 'File'}</small>
                  </div>
                </div>
              )}
            </div>
          )}

          {text && <p>{text}</p>}

          {Object.keys(reactions || {}).length > 0 && (
            <div className="message-reactions" aria-label="Message reactions">
              {reactionOptions.map((emoji) => {
                const count = reactions[emoji]?.length ?? 0
                if (!count) return null
                return (
                  <button key={emoji} type="button" className="reaction-pill" onClick={() => onReact?.(id, emoji)}>
                    <span>{emoji}</span>
                    <small>{count}</small>
                  </button>
                )
              })}
            </div>
          )}

          {me && statusMeta && (
            <div className={`message-status ${statusMeta.className}`}>
              <span className="status-icon">{statusMeta.icon}</span>
              <span>{statusMeta.label}</span>
            </div>
          )}
        </div>

        <div className="message-menu-wrap">
          <button type="button" className="message-menu-button" aria-label="Message actions" onClick={() => setShowMenu((isOpen) => !isOpen)}>
            ⋯
          </button>

          {showMenu && (
            <div className="message-menu" role="menu" aria-label="Message actions">
              {menuItems.map((item) => (
                <button key={item.label} type="button" onClick={item.action} role="menuitem">
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {showDeleteOptions && (
            <div className="delete-choice-popover" role="dialog" aria-label="Delete message options">
              <p>Delete message</p>
              <button type="button" className="delete-choice-button" onClick={() => handleDeleteChoice('me')}>
                Delete for me
              </button>
              {canDeleteEveryone && (
                <button type="button" className="delete-choice-button danger" onClick={() => handleDeleteChoice('everyone')}>
                  Delete for everyone
                </button>
              )}
              <button type="button" className="delete-choice-cancel" onClick={() => setShowDeleteOptions(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {me && (
        hasImageAvatar ? (
          <img className="message-avatar message-avatar-self" src={avatar} alt={sender || 'You'} />
        ) : (
          <span className="message-avatar message-avatar-self">{avatar || sender?.slice(0, 1) || 'U'}</span>
        )
      )}
    </div>
  )
}

export default Message
