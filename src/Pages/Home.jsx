import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import '../Styles/Home.css'

const CONTACT_EMAIL = 'agreemdey23@gmail.com'
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xeaeklzn'

const navItems = [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'Contact', href: '#contact' },
]
const sectionIds = navItems.map((item) => item.href.slice(1))

const features = [
    { tone: 'coral', title: 'Keep the thread', text: 'Every thought has a place, so your team can move forward without digging through noise.' },
    { tone: 'blue', title: 'Find your rhythm', text: 'Focused channels and gentle notifications keep communication clear and human.' },
    { tone: 'mint', title: 'Make it yours', text: 'Shape each space around the people, projects, and rituals that matter most.' },
    { tone: 'lavender', title: 'Talk in the moment', text: 'Messages land the instant they are sent, so conversations keep pace with your thoughts.' },
    { tone: 'sand', title: 'Bring everyone in', text: 'Invite teammates and friends into a space and get talking right away.' },
    { tone: 'rose', title: 'Pick up anywhere', text: 'Your conversations follow you from screen to screen, so nothing gets lost.' },
]

async function sendMessage(payload) {
    const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: payload.name,
            email: payload.email,
            message: payload.message,
        }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error || `Request failed with status ${response.status}`)
    }

    return response
}

/* Scroll progress, hero parallax (--sy), navbar state and scroll-spy.
   Custom properties are written to the elements that use them (NOT :root), so a scroll
   frame never invalidates styles for the whole page. DOM reads happen before writes. */
function useScrollEffects(ids) {
    const [scrolled, setScrolled] = useState(false)
    const [active, setActive] = useState(ids[0])

    useEffect(() => {
        const bar = document.querySelector('.scroll-progress')
        const hero = document.getElementById(ids[0])
        const sections = ids.map((id) => document.getElementById(id))
        let frame = 0

        const update = () => {
            frame = 0
            const y = window.scrollY
            const vh = window.innerHeight
            const max = document.documentElement.scrollHeight - vh

            // reads
            let current = ids[0]
            sections.forEach((el, i) => {
                if (el && el.getBoundingClientRect().top <= vh * 0.4) current = ids[i]
            })
            if (max > 0 && y >= max - 4) current = ids[ids.length - 1]

            // writes
            if (bar) bar.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : '0')
            if (hero && y < vh * 1.5) hero.style.setProperty('--sy', String(Math.round(y)))
            setScrolled(y > 24)
            setActive(current)
        }
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update)
        }

        update()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            if (hero) hero.style.removeProperty('--sy')
            if (bar) bar.style.removeProperty('--progress')
        }
    }, [ids])

    return { scrolled, active }
}

/* Adds .is-visible to every [data-reveal] element as it enters the viewport */
function useReveal() {
    useEffect(() => {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible')
                        io.unobserve(entry.target)
                    }
                })
            },
            { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
        )
        document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el))
        return () => io.disconnect()
    }, [])
}

/* Sticky card stack: earlier cards shrink as later cards slide over them.
   Effect inspired by Skiper UI (Skiper 16 StickyCard_001), rebuilt without extra dependencies.
   Smoothness notes:
   - layout is measured once (and on resize), so a scroll frame does no layout reads at all
   - the scale eases toward its target (lerp) instead of snapping, which hides the gap between
     the compositor-driven sticky movement and main-thread JS
   - the transform is written straight to the element (no CSS-variable cascade into the card) */
function useCardStack(ref) {
    useEffect(() => {
        const box = ref.current
        if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

        const items = Array.from(box.querySelectorAll('.stack-item'))
        const layers = items.map((el) => el.firstElementChild)
        const current = items.map(() => 1)
        const target = items.map(() => 1)
        let tops = [] // document-space top of each card before it sticks
        let stuck = [] // sticky `top` offset of each card
        let range = 1
        let frame = 0
        let last = 0

        const measure = () => {
            range = window.innerHeight * 0.7
            const gap = parseFloat(getComputedStyle(box).rowGap) || 0
            let offset = box.getBoundingClientRect().top + window.scrollY
            tops = items.map((el) => {
                const top = offset
                offset += el.offsetHeight + gap
                return top
            })
            stuck = items.map((el) => parseFloat(getComputedStyle(el).top) || 0)
        }

        const computeTargets = () => {
            const y = window.scrollY
            // 0 = card still below its stuck spot, 1 = fully stacked
            const arrived = tops.map((top, i) => Math.min(1, Math.max(0, 1 - (top - y - stuck[i]) / range)))
            for (let i = 0; i < items.length; i++) {
                let shrink = 0
                for (let j = i + 1; j < items.length; j++) shrink += arrived[j]
                target[i] = Math.max(0.72, 1 - 0.04 * shrink)
            }
        }

        const tick = (now) => {
            frame = 0
            const dt = Math.min(0.05, (now - last) / 1000)
            last = now
            computeTargets()
            const k = 1 - Math.exp(-Math.max(dt, 0.008) * 12) // frame-rate independent easing
            let moving = false
            for (let i = 0; i < items.length; i++) {
                const diff = target[i] - current[i]
                if (Math.abs(diff) > 0.0005) {
                    current[i] += diff * k
                    moving = true
                } else {
                    current[i] = target[i]
                }
                layers[i].style.transform = `scale(${current[i].toFixed(4)})`
            }
            if (moving) frame = requestAnimationFrame(tick)
        }

        const kick = () => {
            if (frame) return
            last = performance.now()
            frame = requestAnimationFrame(tick)
        }
        const onResize = () => {
            measure()
            kick()
        }

        measure()
        computeTargets()
        items.forEach((_, i) => {
            current[i] = target[i]
            layers[i].style.transform = `scale(${current[i].toFixed(4)})`
        })

        const ro = new ResizeObserver(onResize)
        ro.observe(box)
        window.addEventListener('scroll', kick, { passive: true })
        window.addEventListener('resize', onResize)
        return () => {
            cancelAnimationFrame(frame)
            ro.disconnect()
            window.removeEventListener('scroll', kick)
            window.removeEventListener('resize', onResize)
            layers.forEach((l) => l.style.removeProperty('transform'))
        }
    }, [ref])
}

/* 3D tilt: pointer position drives --rx / --ry / --gx / --gy (see HomeExtras.css) */
function Tilt({ as: Tag = 'div', max = 8, className = '', children, ...rest }) {
    const ref = useRef(null)

    const handleMove = (e) => {
        if (e.pointerType === 'touch') return
        const el = ref.current
        const rect = el.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height
        el.style.setProperty('--ry', `${((x - 0.5) * 2 * max).toFixed(2)}deg`)
        el.style.setProperty('--rx', `${((0.5 - y) * 2 * max).toFixed(2)}deg`)
        el.style.setProperty('--gx', `${(x * 100).toFixed(0)}%`)
        el.style.setProperty('--gy', `${(y * 100).toFixed(0)}%`)
    }
    const handleLeave = () => {
        ref.current.style.setProperty('--rx', '0deg')
        ref.current.style.setProperty('--ry', '0deg')
    }

    return (
        <Tag
            ref={ref}
            className={`tilt ${className}`}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
            {...rest}
        >
            {children}
            <span className="tilt-glare" aria-hidden="true" />
        </Tag>
    )
}

const DEMO_MESSAGES = [
    {
        id: 1,
        side: 'left',
        avatar: 'JD',
        avatarTone: 'coral',
        name: 'Jamie',
        time: '10:42',
        text: 'Good morning, team. Ready to make something great?',
    },
    {
        id: 2,
        side: 'right',
        avatar: 'YO',
        avatarTone: 'yellow',
        name: 'You',
        time: '10:43',
        text: 'Already on it. The new space feels so calm.',
    },
    {
        id: 3,
        side: 'left',
        avatar: 'JD',
        avatarTone: 'coral',
        name: 'Jamie',
        time: '10:44',
        text: 'Nice. I just cleaned up the project board.',
    },
    {
        id: 4,
        side: 'right',
        avatar: 'YO',
        avatarTone: 'yellow',
        name: 'You',
        time: '10:44',
        text: 'Perfect. I will take the next screen.',
    },
    {
        id: 5,
        side: 'left',
        avatar: 'JD',
        avatarTone: 'coral',
        name: 'Jamie',
        time: '10:45',
        text: 'Deal. Sending the updated flow now.',
    },
    {
        id: 6,
        side: 'right',
        avatar: 'YO',
        avatarTone: 'yellow',
        name: 'You',
        time: '10:45',
        text: 'Got it — this is looking really good.',
    },
]

function useHeroChatDemo() {
    const [isHovered, setIsHovered] = useState(false)
    const [visibleMessages, setVisibleMessages] = useState(DEMO_MESSAGES.slice(0, 2))
    const [typing, setTyping] = useState(null)

    useEffect(() => {
        if (!isHovered) {
            setTyping(null)
            setVisibleMessages(DEMO_MESSAGES.slice(0, 2))
            return undefined
        }

        let cancelled = false
        let timeoutId

        const runSequence = (index = 2) => {
            if (cancelled) return

            const message = DEMO_MESSAGES[index % DEMO_MESSAGES.length]
            setTyping(message.name)

            timeoutId = window.setTimeout(() => {
                if (cancelled) return

                setVisibleMessages((current) => {
                    const next = [...current, message]
                    return next.length > 4 ? next.slice(-4) : next
                })
                setTyping(null)

                timeoutId = window.setTimeout(() => {
                    runSequence((index + 1) % DEMO_MESSAGES.length || 2)
                }, 1250)
            }, 850)
        }

        timeoutId = window.setTimeout(() => runSequence(2), 700)

        return () => {
            cancelled = true
            window.clearTimeout(timeoutId)
        }
    }, [isHovered])

    return {
        isHovered,
        visibleMessages,
        typing,
        setIsHovered,
    }
}

function Home() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', message: '' })
    const [status, setStatus] = useState('idle') // idle | sending | sent | error
    const { isHovered, visibleMessages, typing, setIsHovered } = useHeroChatDemo()
    const { scrolled, active } = useScrollEffects(sectionIds)
    useReveal()
    const stackRef = useRef(null)
    useCardStack(stackRef)

    const closeMenu = () => setMenuOpen(false)

    const handleChange = (e) => {
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
        if (status !== 'idle' && status !== 'sending') setStatus('idle')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setStatus('sending')
        try {
            await sendMessage(form)
            setForm({ name: '', email: '', message: '' })
            setStatus('sent')
        } catch {
            setStatus('error')
        }
    }

    return (
        <main className="site-shell">
            <div className="scroll-progress" aria-hidden="true" />

            <nav className={`floating-navbar ${scrolled ? 'is-scrolled' : ''}`} aria-label="Main navigation">
                <a className="logo" href="#home" onClick={closeMenu} data-reveal style={{ '--d': '0ms' }}>
                    <span className="logo-mark">n</span>
                    Nex Chat<span className="logo-dot">.</span>
                </a>

                <button
                    className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
                    data-reveal
                    style={{ '--d': '80ms' }}
                    type="button"
                    aria-label="Toggle navigation menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((isOpen) => !isOpen)}
                >
                    <span />
                    <span />
                </button>

                <div className={`nav-content ${menuOpen ? 'is-open' : ''}`}>
                    <ul className="nav-links">
                        {navItems.map((item, index) => (
                            <li key={item.href} data-reveal style={{ '--d': `${120 + index * 70}ms` }}>
                                <a
                                    className={active === item.href.slice(1) ? 'active' : ''}
                                    href={item.href}
                                    onClick={closeMenu}
                                >
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <Link className="btn-cta" to="/register" onClick={closeMenu} data-reveal style={{ '--d': '330ms' }}>
                        Get started <span aria-hidden="true">↗</span>
                    </Link>
                </div>
            </nav>

            <section className="hero-section" id="home">
                <div className="hero-copy">
                    <p className="eyebrow" data-reveal style={{ '--d': '0ms' }}><span /> Your people, in sync</p>
                    <h1 className="hero-h1" data-reveal style={{ '--d': '90ms' }}>
                         Make room for <em className="em-better">better</em> conversations.
                    </h1>
                    <p className="hero-subtitle" data-reveal style={{ '--d': '180ms' }}>
                        Conversations that feel instant. Communication built for the modern web.
                    </p>
                    <div className="hero-actions" data-reveal style={{ '--d': '270ms' }}>
                        <a className="primary-action" href="/register" onClick={closeMenu}>
                            Dive into the Journey <span aria-hidden="true">↗</span>
                        </a>
                        <a className="secondary-action" href="#features">
                            Explore the space <span aria-hidden="true">→</span>
                        </a>
                    </div>
                </div>

                <Tilt className="hero-stage" max={7} data-reveal style={{ '--d': '340ms' }}>
                    <div
                        className={`hero-visual ${isHovered ? 'chat-demo-active' : ''}`}
                        aria-label="Nex Chat live conversation preview"
                        onPointerEnter={(e) => {
                            if (e.pointerType !== 'touch') setIsHovered(true)
                        }}
                        onPointerLeave={(e) => {
                            if (e.pointerType !== 'touch') setIsHovered(false)
                        }}
                    >
                        <div className="visual-label">
                            {isHovered ? 'Live demo' : 'Live workspace'} <span>●</span>
                        </div>

                        <div className="chat-window">
                            <div className="chat-topbar">
                                <div className="chat-channel">
                                    <span className="channel-icon">#</span>
                                    <div>
                                        <strong>the-lounge</strong>
                                        <small>{isHovered ? '2 people chatting' : '8 people here'}</small>
                                    </div>
                                </div>
                                <span className="more-dots">•••</span>
                            </div>

                            <div className="chat-messages" aria-live="polite">
                                {visibleMessages.map((message, index) => (
                                    <div
                                        className={`message-row ${message.side === 'right' ? 'message-row-right' : ''} message-enter`}
                                        key={message.id}
                                        style={{ '--message-delay': `${index * 100}ms` }}
                                    >
                                        {message.side === 'left' && (
                                            <span className={`message-avatar ${message.avatarTone}`}>
                                                {message.avatar}
                                            </span>
                                        )}

                                        <div className={`message-bubble ${message.side === 'right' ? 'bubble-mint' : ''}`}>
                                            <strong>
                                                {message.name} <small>{message.time}</small>
                                            </strong>
                                            <p>{message.text}</p>
                                            {message.side === 'right' && (
                                                <span className="message-status" aria-label="Read">✓✓</span>
                                            )}
                                        </div>

                                        {message.side === 'right' && (
                                            <span className={`message-avatar ${message.avatarTone}`}>
                                                {message.avatar}
                                            </span>
                                        )}
                                    </div>
                                ))}

                                {typing && (
                                    <div className={`typing-state ${typing === 'You' ? 'typing-right' : ''}`}>
                                        <span /><span /><span /> {typing} is typing
                                    </div>
                                )}
                            </div>

                            <div className="chat-input">
                                <span className="input-placeholder">
                                    {typing ? `${typing} is typing...` : 'Write a message...'}
                                </span>
                                <span className="input-send" aria-hidden="true">⌁</span>
                            </div>
                        </div>

                        <span className="visual-sticker sticker-one">
                            {isHovered ? 'watch it flow' : 'made for flow'}
                        </span>
                        <span className="visual-sticker sticker-two">✦</span>
                    </div>
                </Tilt>
            </section>

            <section className="feature-section" id="features">
                <div className="section-heading" data-reveal>
                    <p className="eyebrow"><span /> Built for the way you work</p>
                    <h2>Less noise. More <em>momentum.</em></h2>
                </div>
                <div className="card-stack" ref={stackRef}>
                    {features.map((f, i) => (
                        <div className="stack-item" key={f.title} data-reveal style={{ '--i': i, '--d': `${i * 90}ms` }}>
                            <div className="stack-scale">
                                <Tilt as="article" max={5} className={`feature-card stack-card feature-card-${f.tone}`}>
                                    <span className="feature-number">{String(i + 1).padStart(2, '0')}</span>
                                    <h3>{f.title}</h3>
                                    <p>{f.text}</p>
                                    <span className="feature-arrow" aria-hidden="true">↗</span>
                                </Tilt>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="contact-section" id="contact">
                <div className="section-heading" data-reveal>
                    <p className="eyebrow"><span /> Get in touch</p>
                    <h2>Have a question? <em>Say hello.</em></h2>
                </div>

                <div className="contact-grid">
                    <div className="contact-info" data-reveal>
                        <p className="contact-lead">
                            Questions, feedback or ideas for your team's space? Send us a note and we'll get back to you by email.
                        </p>
                        <ul className="contact-list">
                            <li>
                                <a href={`mailto:${CONTACT_EMAIL}`} data-reveal style={{ '--d': '80ms' }}>
                                    <b aria-hidden="true">@</b>
                                    <span>
                                        <strong>Email us</strong>
                                        <small>{CONTACT_EMAIL}</small>
                                    </span>
                                </a>
                            </li>
                            <li>
                                <Link to="/register" data-reveal style={{ '--d': '160ms' }}>
                                    <b aria-hidden="true">#</b>
                                    <span>
                                        <strong>Start chatting</strong>
                                        <small>Create your Nex Chat account</small>
                                    </span>
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div data-reveal style={{ '--d': '140ms' }}>
                        <Tilt className="contact-card" max={3}>
                            <form className="contact-form" onSubmit={handleSubmit}>
                                <div className="field-row">
                                    <div className="field">
                                        <label htmlFor="contact-name">Name</label>
                                        <input
                                            id="contact-name"
                                            name="name"
                                            type="text"
                                            autoComplete="name"
                                            placeholder="Your name"
                                            value={form.name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="field">
                                        <label htmlFor="contact-email">Email</label>
                                        <input
                                            id="contact-email"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            placeholder="you@example.com"
                                            value={form.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="field">
                                    <label htmlFor="contact-message">Message</label>
                                    <textarea
                                        id="contact-message"
                                        name="message"
                                        placeholder="How can we help?"
                                        value={form.message}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <button className="primary-action submit-btn" type="submit" disabled={status === 'sending'}>
                                    {status === 'sending' ? 'Sending...' : 'Send message'} <span aria-hidden="true">↗</span>
                                </button>
                                <p className={`form-status ${status}`} role="status" aria-live="polite">
                                    {status === 'sent' && 'Message sent. We will reply to your email soon.'}
                                    {status === 'error' && `Message not sent. Try again, or email ${CONTACT_EMAIL}.`}
                                </p>
                            </form>
                        </Tilt>
                    </div>
                </div>
            </section>

            <footer className="site-footer">
                <div data-reveal style={{ '--d': '0ms' }}>
                    <a className="logo" href="#home"><span className="logo-mark">n</span> Nex Chat<span className="logo-dot">.</span></a>
                    <p>Good work starts with a good conversation.</p>
                </div>
                <a className="footer-link" data-reveal style={{ '--d': '100ms' }}>Made with &#x2764;&#xFE0F; by Agreem <span aria-hidden="true">↗</span></a>
            </footer>
        </main>
    )
}

export default Home 