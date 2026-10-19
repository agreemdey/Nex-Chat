import { useEffect, useState } from 'react'
import Sidebar from '../Components/Sidebar'
import ChatWindow from '../Components/ChatWindow'
import { useChat } from '../Context/ChatContext'
import '../Styles/Chat.css'

function Chat() {
  const { currentChat, setCurrentChat } = useChat()
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 900 : false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const handleResize = (event) => setIsMobile(event.matches)

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleResize)

    return () => mediaQuery.removeEventListener('change', handleResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleBack = () => {
      if (currentChat) {
        setCurrentChat(null)
      }

      window.history.pushState({ chatSecure: true }, '', '/chat')
    }

    const state = window.history.state
    if (!state || state.chatSecure !== true) {
      window.history.pushState({ chatSecure: true }, '', '/chat')
    }

    window.addEventListener('popstate', handleBack)
    return () => window.removeEventListener('popstate', handleBack)
  }, [currentChat, setCurrentChat])

  const mobileSidebarOnly = isMobile && !currentChat

  return (
    <main className={`chat-app-shell ${isMobile ? 'mobile-chat' : ''} ${mobileSidebarOnly ? 'mobile-sidebar-only' : ''}`}>
      <Sidebar />
      {!mobileSidebarOnly && <ChatWindow />}
    </main>
  )
}

export default Chat