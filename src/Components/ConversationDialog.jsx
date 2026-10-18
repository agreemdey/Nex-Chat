import { useState } from 'react'
import { useChat } from '../Context/ChatContext'
import '../Styles/ConversationDialog.css'

function ConversationDialog({ onClose }) {
  const { createConversation, searchUsers, chats, selectChat } = useChat()
  const [name, setName] = useState('')
  const [type, setType] = useState('direct')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (event) => {
    const nextQuery = event.target.value
    setQuery(nextQuery)
    if (nextQuery.trim().length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      setResults(await searchUsers(nextQuery))
    } catch (searchError) {
      setError(searchError.message)
    } finally {
      setIsSearching(false)
    }
  }

  const startDirectChat = async (user) => {
    const existingDirectChat = chats.find((chat) => {
      const memberIds = chat.memberIds ?? []
      return chat.type === 'direct' && memberIds.includes(user.id) && memberIds.length <= 2
    })

    if (existingDirectChat) {
      selectChat(existingDirectChat)
      onClose()
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const created = await createConversation({
        name: user.full_name || user.username || 'Direct message',
        type: 'direct',
        memberIds: [user.id],
      })
      selectChat(created)
      onClose()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setIsCreating(false)
    }
  }

  const toggleUser = (user) => {
    if (type === 'direct') {
      startDirectChat(user)
      return
    }

    setSelectedUsers((currentUsers) => currentUsers.some((item) => item.id === user.id)
      ? currentUsers.filter((item) => item.id !== user.id)
      : [...currentUsers, user])
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (type === 'direct') {
      if (selectedUsers.length > 0) {
        await startDirectChat(selectedUsers[0])
      }
      return
    }

    if (!name.trim()) {
      setError('Enter a conversation name.')
      return
    }

    setIsCreating(true)
    setError('')
    try {
      await createConversation({
        name,
        type,
        memberIds: selectedUsers.map((user) => user.id),
      })
      onClose()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="conversation-dialog" role="dialog" aria-modal="true" aria-labelledby="conversation-dialog-title">
        <div className="dialog-heading">
          <div>
            <p className="dialog-kicker">New space</p>
            <h2 id="conversation-dialog-title">Start a conversation</h2>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">×</button>
        </div>

        {error && <p className="dialog-error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit}>
          {type !== 'direct' && (
            <>
              <label htmlFor="conversation-name">Name</label>
              <input id="conversation-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Project room" autoFocus />
            </>
          )}

          <label htmlFor="conversation-type">Type</label>
          <select id="conversation-type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="direct">Direct</option>
            <option value="group">Group</option>
          </select>

          <label htmlFor="member-search">Add people</label>
          <input id="member-search" value={query} onChange={handleSearch} placeholder="Search by name, username, or email" />
          {isSearching && <small>Searching...</small>}

          <div className="member-results">
            {results.map((user) => {
              const isSelected = selectedUsers.some((item) => item.id === user.id)
              const avatarUrl = user.avatar_url || user.avatarUrl || user.avatar || null
              const displayName = user.full_name || user.username || 'User'

              return (
                <button key={user.id} type="button" className={`member-result ${isSelected ? 'selected' : ''}`} onClick={() => toggleUser(user)}>
                  <span className="member-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} />
                    ) : (
                      displayName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span><strong>{displayName}</strong><small>@{user.username}</small></span>
                  <span aria-hidden="true">{isSelected ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>

          <button className="dialog-submit" type="submit" disabled={isCreating}>
            {isCreating ? 'Opening chat...' : type === 'direct' ? 'Open chat' : 'Create conversation'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default ConversationDialog
