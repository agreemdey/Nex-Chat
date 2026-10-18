import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Context/AuthContext'
import '../Styles/Register-Login.css'

function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters long.')
    if (password !== confirmPassword) return setError('Passwords do not match.')

    setIsSaving(true)
    setError('')
    try {
      await updatePassword(password)
      setMessage('Your password has been updated. You can log in now.')
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="register-page">
      <section className="register-panel">
        <div className="register-panel-inner">
          <div className="register-heading">
            <p className="register-kicker">Account security</p>
            <h2>Choose a new password.</h2>
            <p>Use at least eight characters for your new NexChat password.</p>
          </div>
          {error && <div className="form-message error-message" role="alert">{error}</div>}
          {message && <div className="form-message success-message" role="status">{message}</div>}
          <form className="register-form" onSubmit={handleSubmit}>
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <label htmlFor="confirm-new-password">Confirm password</label>
            <input id="confirm-new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            <button className="register-submit" type="submit" disabled={isSaving || Boolean(message)}>
              {isSaving ? 'Updating...' : 'Update password'}
            </button>
          </form>
          {message && <button type="button" className="text-link" onClick={() => navigate('/login')}>Return to login</button>}
        </div>
      </section>
    </main>
  )
}

export default ResetPassword
