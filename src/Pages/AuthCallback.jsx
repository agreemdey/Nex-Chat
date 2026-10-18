import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Context/AuthContext'

function AuthCallback() {
	const navigate = useNavigate()
	const { loading, isAuthenticated, error } = useAuth()

	useEffect(() => {
		if (loading) return
		if (isAuthenticated) {
			navigate('/chat', { replace: true })
		}
	}, [isAuthenticated, loading, navigate])

	if (error) {
		return (
			<main>
				<h1>Email confirmation failed</h1>
				<p>{error}</p>
				<button type="button" onClick={() => navigate('/login')}>Return to login</button>
			</main>
		)
	}

	return <main>{loading ? 'Confirming your email...' : 'Your email is confirmed. Redirecting...'}</main>
}

export default AuthCallback
