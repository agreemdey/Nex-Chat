import { useEffect, useRef, useState } from 'react'
import { useChat } from '../Context/ChatContext'
import '../Styles/MessageInput.css'

function MessageInput({ placeholder = 'Write a message...', replyTo = null, onCancelReply = null }) {
  const { sendMessage, sendTyping, sendingMessage } = useChat()
  const [value, setValue] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [attachments, setAttachments] = useState([])
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const addEmoji = (emoji) => {
    setValue((currentValue) => `${currentValue}${emoji}`)
    setShowEmojiPicker(false)
  }

  const handleFiles = (event) => {
    const nextFiles = Array.from(event.target.files || []).map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }))

    setAttachments((currentAttachments) => [...currentAttachments, ...nextFiles].slice(0, 3))
    event.target.value = ''
  }

  const clearAttachments = () => {
    setAttachments([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if ((!value.trim() && attachments.length === 0) || sendingMessage) return

    const primaryAttachment = attachments[0] ?? null
    const replyText = replyTo ? `Replying to ${replyTo.sender}: ${replyTo.text}\n${value}` : value
    sendMessage(replyText, primaryAttachment)
    sendTyping(false)
    setValue('')
    clearAttachments()
    if (onCancelReply) onCancelReply()
  }

  const handleChange = (event) => {
    const nextValue = event.target.value
    setValue(nextValue)
    sendTyping(Boolean(nextValue.trim()))

    window.clearTimeout(typingTimeoutRef.current)
    if (nextValue.trim()) {
      typingTimeoutRef.current = window.setTimeout(() => sendTyping(false), 1200)
    }
  }

  useEffect(() => () => {
    window.clearTimeout(typingTimeoutRef.current)
    sendTyping(false)
  }, [sendTyping])

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <div className="message-input-field">
        {replyTo && (
          <div className="reply-preview" aria-live="polite">
            <div className="reply-preview-label">Replying to {replyTo.sender}</div>
            <div className="reply-preview-text">{replyTo.text}</div>
            <button type="button" className="reply-cancel" onClick={onCancelReply}>Cancel</button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="message-input-attachments" aria-label="Selected attachments">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="attachment-pill">
                {attachment.url ? <img src={attachment.url} alt={attachment.name} /> : <span>📎</span>}
                <small>{attachment.name}</small>
              </div>
            ))}
            <button type="button" className="clear-attachments" onClick={clearAttachments}>Clear</button>
          </div>
        )}

        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          aria-label="Write a message"
        />

        <div className="message-input-tools">
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            className="attachment-input"
            onChange={handleFiles}
            aria-label="Attach a file or image"
          />
          <button
            type="button"
            className="message-input-icon"
            aria-label="Attach a file"
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>
        </div>

        {showEmojiPicker && (
          <div className="emoji-picker" aria-label="Emoji picker">
            {emojis.map((emoji) => (
              <button key={emoji} type="button" onClick={() => addEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="message-input-send" type="submit" disabled={sendingMessage}>
        {sendingMessage ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}

export default MessageInput