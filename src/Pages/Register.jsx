import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Context/AuthContext'
import '../Styles/Register-Login.css'

const initialForm = {
	fullName: '',
	username: '',
	email: '',
	password: '',
	confirmPassword: '',
	profilePicture: '',
	termsAccepted: false,
}

function Register() {
	const navigate = useNavigate()
	const { isAuthenticated, register, resendConfirmation, loginWithGoogle, error: authError } = useAuth()
	const [form, setForm] = useState(initialForm)
	const [submitted, setSubmitted] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [isResending, setIsResending] = useState(false)
	const [error, setError] = useState('')
	const [successMessage, setSuccessMessage] = useState('')
	const [resendMessage, setResendMessage] = useState('')

	const passwordStrength = useMemo(() => {
		if (!form.password) {
			return { score: 0, label: '', color: '#cbd5e1' }
		}

		let score = 0

		if (form.password.length >= 8) score += 1
		if (/[A-Z]/.test(form.password)) score += 1
		if (/[0-9]/.test(form.password)) score += 1
		if (/[^A-Za-z0-9]/.test(form.password)) score += 1

		if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' }
		if (score === 2) return { score: 2, label: 'Fair', color: '#f59e0b' }
		if (score === 3) return { score: 3, label: 'Good', color: '#3b82f6' }

		return { score: 4, label: 'Strong', color: '#22c55e' }
	}, [form.password])

	useEffect(() => {
		if (isAuthenticated) {
			navigate('/chat', { replace: true })
		}
	}, [isAuthenticated, navigate])

	const handleChange = (event) => {
		const { name, value, checked, type, files } = event.target

		setForm((currentForm) => ({
			...currentForm,
			[name]: type === 'checkbox' ? checked : type === 'file' ? files?.[0]?.name || '' : value,
		}))

		if (error) setError('')
		if (successMessage) setSuccessMessage('')
		if (resendMessage) setResendMessage('')
	}

	const handleResendConfirmation = async () => {
		setIsResending(true)
		setResendMessage('')

		try {
			await resendConfirmation(form.email)
			setResendMessage('A new confirmation link has been sent. Check your inbox and spam folder.')
		} catch (resendError) {
			setResendMessage(resendError.message)
		} finally {
			setIsResending(false)
		}
	}

	const handleSubmit = async (event) => {
		event.preventDefault()

		if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.password || !form.confirmPassword) {
			setError('Please fill in all required fields.')
			setSubmitted(false)
			return
		}

		if (form.password.length < 8) {
			setError('Password must be at least 8 characters long.')
			setSubmitted(false)
			return
		}

		if (form.password !== form.confirmPassword) {
			setError('Passwords do not match. Please try again.')
			setSubmitted(false)
			return
		}

		if (!form.termsAccepted) {
			setError('Please accept the terms and privacy policy to continue.')
			setSubmitted(false)
			return
		}

		setError('')
		setSuccessMessage('Your Nex Chat account is ready. Welcome to the conversation.')
		setIsLoading(true)

		try {
			const registeredUser = await register(form.fullName, form.username, form.email, form.password)
			if (registeredUser) {
				navigate('/chat', { replace: true })
			} else {
				setSuccessMessage('Account created. Check your email to confirm your account before logging in.')
				setSubmitted(true)
			}
		} catch (registerError) {
			setError(registerError.message)
			setSubmitted(false)
		} finally {
			setIsLoading(false)
		}
	}

	const handleGoogleLogin = async () => {
		try {
			await loginWithGoogle()
		} catch (oauthError) {
			setError(oauthError.message)
		}
	}

	return (
		<main className="register-page register-page-dark">
			<section className="register-showcase" aria-label="Nex Chat introduction">
				<button className="register-brand" type="button" onClick={() => navigate('/')}>
					<span className="register-brand-mark">n</span>
					Nex Chat<span className="register-brand-dot">.</span>
				</button>
				<div className="showcase-copy">
					<p className="register-kicker"><span /> A calmer way to connect</p>
					<h1>Bring your people into the <em>same room.</em></h1>
					<p>One focused space for conversations, ideas, and the work that moves everything forward.</p>
				</div>
				<div className="showcase-note">
					<span className="note-mark">✦</span>
					<p><strong>Make space for better work.</strong><br />Your next good conversation starts here.</p>
				</div>
			</section>

			<section className="register-panel">
				<div className="register-panel-inner">
					<button className="back-link" type="button" onClick={() => navigate('/')}>
						<span aria-hidden="true">←</span> Back to home
					</button>

					{submitted ? (
						<div className="success-state" role="status">
							<span className="success-icon">✓</span>
							<p className="register-kicker">You are in</p>
							<h2>Welcome to the conversation.</h2>
							<p>{successMessage || 'Your Nex Chat account is ready. Sign in to continue.'}</p>
							<button className="register-submit" type="button" onClick={() => navigate('/')}>
								Return home <span aria-hidden="true">↗</span>
							</button>
							<button className="text-link" type="button" onClick={handleResendConfirmation} disabled={isResending}>
								{isResending ? 'Sending...' : 'Resend confirmation email'}
							</button>
							{resendMessage && <p className="form-message" role="status">{resendMessage}</p>}
						</div>
					) : (
						<>
							<div className="register-heading">
								<p className="register-kicker">Start your free space</p>
								<h2>Let’s make room.</h2>
								<p>Create your Nex Chat account and invite the right people into the conversation.</p>
							</div>

							{(error || authError) && (
								<div className="form-message error-message" role="alert">{error || authError}</div>
							)}

							{successMessage && (
								<div className="form-message success-message" role="status">{successMessage}</div>
							)}

							<form className="register-form" onSubmit={handleSubmit}>
								<label htmlFor="fullName">Full name</label>
								<input id="fullName" name="fullName" type="text" placeholder="Jamie Davis" value={form.fullName} onChange={handleChange} required />

								<label htmlFor="username">Username</label>
								<input id="username" name="username" type="text" placeholder="jamied" value={form.username} onChange={handleChange} required />

								<label htmlFor="email">Email address</label>
								<input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />

								<label htmlFor="password">Password</label>
								<input id="password" name="password" type="password" placeholder="8 characters minimum" value={form.password} onChange={handleChange} required />

								<div className="password-strength" aria-live="polite">
									<span>Password strength</span>
									<div className="strength-meter" aria-hidden="true">
										{[0, 1, 2, 3].map((index) => (
											<span
												key={index}
												className={index < passwordStrength.score ? 'is-active' : ''}
												style={{ background: index < passwordStrength.score ? passwordStrength.color : undefined }}
											/>
										))}
									</div>
									<small>{passwordStrength.label || 'Add a stronger password'}</small>
								</div>

								<label htmlFor="confirmPassword">Confirm password</label>
								<input id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange} required />

								<label htmlFor="profilePicture" className="upload-label">Profile picture (optional)</label>
								<input id="profilePicture" name="profilePicture" type="file" accept="image/*" onChange={handleChange} className="file-input" />
								<p className={`file-name ${form.profilePicture ? '' : 'muted'}`}>
									{form.profilePicture ? `Selected: ${form.profilePicture}` : 'No file chosen'}
								</p>

								<button className="register-submit" type="submit" disabled={isLoading}>
									{isLoading ? 'Creating account...' : 'Create account'} <span aria-hidden="true">↗</span>
								</button>
							</form>

							<div className="auth-switch">
								<span>Already have an account?</span>
								<button type="button" className="text-link" onClick={() => navigate('/login')}>
									Login
								</button>
							</div>
						</>
					)}
				</div>
			</section>
		</main>
	)
}

export default Register
