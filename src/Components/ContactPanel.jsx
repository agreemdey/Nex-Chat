import { useEffect, useMemo, useState } from 'react'
import { getUserById } from '../Services/api'
import { useAuth } from '../Context/AuthContext'
import { useChat } from '../Context/ChatContext'

function ContactPanel({ onClose, currentChat }) {
  const { user, accessToken } = useAuth()
  const { blockedUsers, toggleBlockUser, isUserOnline } = useChat()
  const [profileDetails, setProfileDetails] = useState(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (!currentChat || currentChat.type !== 'direct') {
      setProfileDetails(null)
      setProfileError('')
      return undefined
    }

    const otherUserId = (currentChat.memberIds ?? []).find((memberId) => memberId !== user?.id) ?? null
    if (!otherUserId || !accessToken) {
      setProfileDetails(null)
      setProfileError('')
      return undefined
    }

    let active = true

    const loadProfile = async () => {
      setIsLoadingProfile(true)
      setProfileError('')

      try {
        const nextProfile = await getUserById(otherUserId, accessToken)
        if (active) setProfileDetails(nextProfile)
      } catch (error) {
        if (active) setProfileError(error.message || 'Unable to load contact details.')
      } finally {
        if (active) setIsLoadingProfile(false)
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [accessToken, currentChat, user?.id])

  const selectedContact = useMemo(() => {
    if (!currentChat) return null

    if (currentChat.type === 'direct') {
      const otherUserId = (currentChat.memberIds ?? []).find((memberId) => memberId !== user?.id) ?? null
      const profile = profileDetails ?? {}
      const liveOnline = otherUserId ? isUserOnline(otherUserId) : Boolean(currentChat.online)
      const statusText = profile.status || profile.bio || (liveOnline ? 'Available to chat' : 'Offline')

      return {
        id: otherUserId ?? currentChat.id,
        name: profile.full_name || currentChat.name || 'Unknown user',
        username: profile.username || currentChat.name || 'unknown',
        avatarUrl: profile.avatar_url || currentChat.avatarUrl || currentChat.avatar || null,
        isOnline: liveOnline,
        status: liveOnline ? 'Online now' : 'Offline',
        statusText,
        about: profile.bio || 'Available for a quick chat',
        email: profile.email || null,
      }
    }

    return {
      id: currentChat.id,
      name: currentChat.name,
      username: currentChat.name,
      avatarUrl: currentChat.avatarUrl || currentChat.avatar || null,
      isOnline: Boolean(currentChat.online),
      status: currentChat.online ? 'Online now' : 'Offline',
      about: currentChat.type === 'group' ? 'Group conversation' : 'Team conversation',
    }
  }, [currentChat, isUserOnline, profileDetails, user?.id])

  const isDirect = currentChat?.type === 'direct'
  const isBlocked = selectedContact?.id ? blockedUsers.includes(selectedContact.id) : false

  return (
    <div className="contact-panel-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="contact-panel" aria-label="Contact details">
        <div className="contact-panel-header">
          <div>
            <p className="contact-panel-eyebrow">{isDirect ? 'Profile' : 'Conversation'}</p>
            <h3>{isDirect ? 'Contact info' : 'Group info'}</h3>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close contacts">×</button>
        </div>

        {selectedContact && (
          <div className="contact-details-card">
            <div className="contact-profile-top">
              <span className="contact-details-avatar large">
                {selectedContact.avatarUrl ? (
                  <img src={selectedContact.avatarUrl} alt={selectedContact.name} />
                ) : (
                  (selectedContact.name || selectedContact.username || 'U').slice(0, 1).toUpperCase()
                )}
              </span>
              <div>
                <strong>{selectedContact.name}</strong>
                <small>@{selectedContact.username}</small>
              </div>
            </div>

            <div className="contact-strip">
              <div className={`contact-details-status ${selectedContact.isOnline ? 'online' : 'offline'}`}>
                <span className={`presence-dot ${selectedContact.isOnline ? 'online' : 'offline'}`} />
                {selectedContact.status}
              </div>
              
              {isDirect && selectedContact.email && <span className="contact-email">{selectedContact.email}</span>}
            </div>

            {isLoadingProfile && <div className="contact-panel-loading">Loading profile details…</div>}
            {profileError && !isLoadingProfile && <div className="contact-panel-error">{profileError}</div>}

            {!isLoadingProfile && !profileError && (
              <>
                <div className="contact-meta-block">
                  <span className="meta-label">About</span>
                  <p>{selectedContact.about}</p>
                </div>

                <div className="contact-info-grid">
                  <div className="info-pill">
                    <span className="info-kicker">Status</span>
                    <strong>{selectedContact.status}</strong>
                  </div>
                  <div className="info-pill">
                    <span className="info-kicker">Privacy</span>
                    <strong>{isBlocked ? 'Blocked' : 'Normal'}</strong>
                  </div>
                  <div className="info-pill">
                    <span className="info-kicker">Share</span>
                    <strong>{isDirect ? 'Direct' : 'Group'}</strong>
                  </div>
                </div>
              </>
            )}

            {isDirect && (
              <div className="contact-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => toggleBlockUser(selectedContact.id)}
                >
                  {isBlocked ? 'Unblock' : 'Block'}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

export default ContactPanel
