import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Context/AuthContext'
import '../Styles/Register-Login.css'

const getInitialForm = () => {
	const storedPreference = typeof window !== 'undefined' ? window.localStorage.getItem('nexchat:remember-me') : null
	return {
		email: '',
		password: '',
		rememberMe: storedPreference === null ? true : storedPreference !== 'false',
	}
}

const initialForm = getInitialForm()

function Login() {
	const navigate = useNavigate()
	const { isAuthenticated, login, loginWithGoogle, resetPassword, error: authError } = useAuth()
	const [form, setForm] = useState(initialForm)
	const [submitted] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState('')
	const [successMessage, setSuccessMessage] = useState('')

	useEffect(() => {
		if (isAuthenticated) {
			navigate('/chat', { replace: true })
		}
	}, [isAuthenticated, navigate])

	const handleChange = (event) => {
		const { name, value, checked, type } = event.target
		setForm((currentForm) => ({
			...currentForm,
			[name]: type === 'checkbox' ? checked : value,
		}))
		if (error) setError('')
		if (successMessage) setSuccessMessage('')
	}

	const handleSubmit = async (event) => {
		event.preventDefault()

		if (!form.email.trim() || !form.password.trim()) {
			setError('Please enter both your email and password.')
			setSuccessMessage('')
			return
		}

		const isEmailValid = /\S+@\S+\.\S+/.test(form.email)
		if (!isEmailValid) {
			setError('Please enter a valid email address.')
			setSuccessMessage('')
			return
		}

		setIsLoading(true)
		setError('')
		setSuccessMessage('')

		try {
			await login(form.email, form.password, form.rememberMe)
			navigate('/chat', { replace: true })
		} catch (loginError) {
			setError(loginError.message)
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

	const handleForgotPassword = async () => {
		if (!form.email.trim() || !form.email.includes('@')) {
			setError('Enter your email address first.')
			return
		}
		try {
			await resetPassword(form.email)
			setError('')
			setSuccessMessage('Password reset email sent. Check your inbox.')
		} catch (resetError) {
			setError(resetError.message)
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
							<p className="register-kicker">Welcome back</p>
							<h2>You’re signed in.</h2>
							<p>{successMessage || 'Your Nex Chat space is ready for the next conversation.'}</p>
							<button className="register-submit" type="button" onClick={() => navigate('/')}>
								Return home <span aria-hidden="true">↗</span>
							</button>
						</div>
					) : (
						<>
							<div className="register-heading">
								<p className="register-kicker">Welcome back</p>
								<h2>Log in to your space.</h2>
								<p>Pick up your conversation where you left off.</p>
							</div>

							{(error || authError) && (
								<div className="form-message error-message" role="alert">{error || authError}</div>
							)}

							{successMessage && (
								<div className="form-message success-message" role="status">{successMessage}</div>
							)}

							<form className="register-form" onSubmit={handleSubmit} noValidate>
								<label htmlFor="email">Email or username</label>
								<input id="email" name="email" type="text" placeholder="you@example.com or jamied" value={form.email} onChange={handleChange} required />

								<label htmlFor="password">Password</label>
								<div className="password-field">
									<input
										id="password"
										name="password"
										type={showPassword ? 'text' : 'password'}
										placeholder="Enter your password"
										value={form.password}
										onChange={handleChange}
										required
									/>
									<button type="button" className="toggle-password" onClick={() => setShowPassword((value) => !value)}>
										{showPassword ? 'Hide' : 'Show'}
									</button>
								</div>

								<div className="login-meta">
									<label className="checkbox-label" htmlFor="rememberMe">
										<input id="rememberMe" name="rememberMe" type="checkbox" checked={form.rememberMe} onChange={handleChange} />
										<span>Keep me signed in</span>
									</label>

									<button type="button" className="text-link subtle-link" onClick={handleForgotPassword}>
										Forgot password?
									</button>
								</div>

								<button className="register-submit" type="submit" disabled={isLoading}>
									{isLoading ? 'Signing in...' : 'Log in'}
									<span aria-hidden="true">↗</span>
								</button>
							</form>

							<div className="auth-switch">
								<span>Don&apos;t have an account?</span>
								<button type="button" className="text-link" onClick={() => navigate('/register')}>
									Create one
								</button>
							</div>
						</>
					)}
				</div>
			</section>
		</main>
	)
}

export default Login
