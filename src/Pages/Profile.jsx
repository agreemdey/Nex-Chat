import { useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Context/AuthContext'
import { useChat } from '../Context/ChatContext'
import { getBlockedUsers, getUserById } from '../Services/api'
import { supabase } from '../Services/supabase'
import '../Styles/Register-Login.css'

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.src = url
  })

const getCroppedImage = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas is not supported in this browser.')
  }

  const outputSize = 512
  canvas.width = outputSize
  canvas.height = outputSize

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  return canvas.toDataURL('image/jpeg', 0.92)
}

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read that image.'))
    reader.readAsDataURL(file)
  })

const uploadAvatarToBucket = async (file, userId) => {
  const candidateBuckets = ['avatars', 'profile-photos', 'user-avatars', 'profile-images']
  let lastError = null

  for (const bucketName of candidateBuckets) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const path = `${userId}/avatar-${uniqueSuffix}.${extension}`
    const { error } = await supabase.storage.from(bucketName).upload(path, file, {
      upsert: true,
      contentType: file.type,
    })

    if (!error) {
      const { data } = supabase.storage.from(bucketName).getPublicUrl(path)
      return { publicUrl: data.publicUrl }
    }

    lastError = error
    if (!error.message.toLowerCase().includes('bucket not found')) {
      throw error
    }
  }

  const fallbackMessage = lastError?.message?.toLowerCase().includes('bucket not found')
    ? 'No Supabase storage bucket was found. Create a public storage bucket named "avatars" (or "profile-photos") in your Supabase project.'
    : lastError?.message || 'Unable to upload avatar.'

  throw new Error(fallbackMessage)
}

function Profile() {
  const navigate = useNavigate()
  const { user, accessToken, updateProfile } = useAuth()
  const { blockedUsers, toggleBlockUser } = useChat()
  const [fullName, setFullName] = useState(user?.name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [bio, setBio] = useState(user?.bio ?? 'Available for a quick chat')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '')
  const [selectedAvatarName, setSelectedAvatarName] = useState('')
  const [blockedContacts, setBlockedContacts] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isCropping, setIsCropping] = useState(false)
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false)
  const [cropEditor, setCropEditor] = useState({
    open: false,
    imageSrc: '',
    crop: { x: 0, y: 0 },
    zoom: 1,
    pixelCrop: null,
    file: null,
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState({
    readReceipts: true,
    notifications: true,
    darkMode: true,
    privateMode: false,
  })

  useEffect(() => {
    setFullName(user?.name ?? '')
    setUsername(user?.username ?? '')
    setBio(user?.bio ?? 'Available for a quick chat')
    setAvatarUrl(user?.avatarUrl ?? '')
  }, [user])

  useEffect(() => {
    if (!accessToken || !user?.id) {
      setBlockedContacts([])
      return undefined
    }

    let active = true

    const loadBlockedContacts = async () => {
      try {
        const rows = await getBlockedUsers(accessToken)
        if (!active || !Array.isArray(rows)) {
          return
        }

        const blockedIds = rows
          .map((row) => row?.user_id ?? row?.blocked_id ?? row?.id)
          .filter(Boolean)
          .map(String)

        if (!blockedIds.length) {
          setBlockedContacts([])
          return
        }

        const profiles = await Promise.all(
          blockedIds.map(async (blockedId) => {
            try {
              const profile = await getUserById(blockedId, accessToken)
              return {
                id: blockedId,
                name: profile?.full_name || profile?.username || 'Blocked user',
                username: profile?.username || 'unknown',
                avatarUrl: profile?.avatar_url || null,
              }
            } catch {
              return {
                id: blockedId,
                name: 'Blocked user',
                username: 'unknown',
                avatarUrl: null,
              }
            }
          }),
        )

        if (active) setBlockedContacts(profiles)
      } catch {
        if (active) setBlockedContacts([])
      }
    }

    loadBlockedContacts()

    return () => {
      active = false
    }
  }, [accessToken, user?.id, blockedUsers])

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !user?.id) return

    setError('')
    setMessage('')

    try {
      setSelectedAvatarName(file.name)
      const imageSrc = await readFileAsDataUrl(file)
      setCropEditor({
        open: true,
        imageSrc,
        crop: { x: 0, y: 0 },
        zoom: 1,
        pixelCrop: null,
        file,
      })
    } catch (uploadError) {
      setError(`Avatar upload failed: ${uploadError.message}`)
    }
  }

  const handleCropAndUpload = async () => {
    if (!cropEditor.imageSrc || !cropEditor.file || !user?.id) return

    setError('')
    setMessage('')
    setIsCropping(true)

    try {
      const pixelCrop = cropEditor.pixelCrop ?? { x: 0, y: 0, width: 1024, height: 1024 }
      const croppedImage = await getCroppedImage(cropEditor.imageSrc, pixelCrop)
      const blob = await fetch(croppedImage).then((response) => response.blob())
      const finalFile = new File([blob], `avatar-${user.id}.jpg`, { type: 'image/jpeg' })
      const result = await uploadAvatarToBucket(finalFile, user.id)

      setAvatarUrl(result.publicUrl)
      setSelectedAvatarName(cropEditor.file?.name || selectedAvatarName)
      setCropEditor({ open: false, imageSrc: '', crop: { x: 0, y: 0 }, zoom: 1, pixelCrop: null, file: null })
      setMessage('Avatar cropped and uploaded. Save your profile to apply it.')
    } catch (uploadError) {
      setError(`Avatar upload failed: ${uploadError.message}`)
    } finally {
      setIsCropping(false)
    }
  }

  const handleDeleteAvatar = async () => {
    if (!user?.id) return

    setError('')
    setMessage('')
    setIsDeletingAvatar(true)

    try {
      if (avatarUrl) {
        try {
          const url = new URL(avatarUrl)
          const pathParts = url.pathname.split('/').filter(Boolean)
          const bucketName = pathParts[3] === 'public' ? pathParts[4] : null
          const objectPath = bucketName ? pathParts.slice(5).join('/') : null

          if (bucketName && objectPath) {
            await supabase.storage.from(bucketName).remove([objectPath])
          }
        } catch {
          // Ignore bucket cleanup errors and continue with database updates.
        }
      }

      setAvatarUrl('')
      await updateProfile({
        full_name: fullName,
        username,
        avatar_url: '',
        bio,
      })
      setMessage('Profile photo removed.')
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setIsDeletingAvatar(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setMessage('')
    try {
      await updateProfile({
        full_name: fullName,
        username,
        avatar_url: avatarUrl,
        bio,
      })
      setMessage('Profile updated.')
      setIsEditing(false)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSetting = (name) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [name]: !currentSettings[name],
    }))
  }

  return (
    <main className="profile-page profile-page-dark">
      <section className="profile-shell">
        <header className="profile-header">
          <button type="button" className="profile-back" onClick={() => navigate('/chat')} aria-label="Back to chat">←</button>
          <div className="profile-header-copy">
            <span>Profile</span>
          </div>
        </header>

        {error && <div className="profile-alert error" role="alert">{error}</div>}
        {message && <div className="profile-alert success" role="status">{message}</div>}

        <div className="profile-card">
          <div className="profile-identity">
            <div className="profile-photo-wrap">
              {avatarUrl ? (
                <img className="profile-photo" src={avatarUrl} alt="Profile preview" />
              ) : (
                <div className="profile-photo-fallback">{(fullName || user?.name || 'U').charAt(0).toUpperCase()}</div>
              )}
            </div>

            <div className="profile-identity-copy">
              <h2>{fullName || user?.name || 'Your name'}</h2>
              <span>@{username || user?.username || 'username'}</span>
              <p><em className='bio-badge'>&#9830; </em> {bio}</p>
            </div>
          </div>

          <div className="profile-meta-bar">
            <span className={`status-pill ${settings.privateMode ? 'muted' : 'online'}`}>
              <span className="status-dot" />
              {settings.privateMode ? 'Last seen recently' : 'Online'}
            </span>
            <button type="button" className="primary-button" onClick={() => setIsEditing((current) => !current)}>
              {isEditing ? 'Close' : 'Edit profile'}
            </button>
          </div>

          <div className="profile-list">
            <div className="profile-row">
              <span>Blocked users</span>
              <strong>{blockedContacts.length}</strong>
            </div>

            {blockedContacts.length > 0 && blockedContacts.map((blockedContact) => (
              <div key={blockedContact.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.08)', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                    {blockedContact.avatarUrl ? (
                      <img src={blockedContact.avatarUrl} alt={blockedContact.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      (blockedContact.name || 'U').charAt(0).toUpperCase()
                    )}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{blockedContact.name}</div>
                    <small style={{ opacity: 0.75 }}>@{blockedContact.username}</small>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleBlockUser(blockedContact.id)}
                  style={{ border: 'none', borderRadius: '999px', padding: '8px 12px', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>

          {isEditing && (
            <form className="profile-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  <span>Name</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                </label>

                <label>
                  <span>Username</span>
                  <input value={username} onChange={(event) => setUsername(event.target.value)} required />
                </label>

                <label className="full-width">
                  <span>Bio / status</span>
                  <input value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Available for a quick chat" />
                </label>

                <label className="full-width">
                  <span>Profile photo</span>
                  <input type="file" accept="image/*" onChange={handleAvatarChange} />
                  {selectedAvatarName && <small style={{ display: 'block', marginTop: '8px', opacity: 0.8 }}>Selected: {selectedAvatarName}</small>}
                </label>

                <div className="avatar-actions full-width">
                  
                  <button type="button" className="delete-button" onClick={handleDeleteAvatar} disabled={isDeletingAvatar}>
                    {isDeletingAvatar ? 'Removing...' : 'Delete avatar'}
                  </button>
                </div>
              </div>

              <button type="submit" className="save-button" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          )}

          <div className="profile-summary">
            <div className="summary-item">
              <span>Privacy</span>
              <strong>{settings.privateMode ? 'Private' : 'Standard'}</strong>
            </div>
            <div className="summary-item">
              <span>Read Receipts</span>
              <strong>{settings.readReceipts ? 'On' : 'Off'}</strong>
            </div>
          </div>
        </div>
      </section>

      {cropEditor.open && (
        <div className="avatar-cropper-backdrop" onClick={() => setCropEditor({ open: false, imageSrc: '', crop: { x: 0, y: 0 }, zoom: 1, pixelCrop: null, file: null })}>
          <div className="avatar-cropper-modal" onClick={(event) => event.stopPropagation()}>
            <div className="avatar-cropper-header">
              <h3>Adjust photo</h3>
              <button type="button" className="crop-close" onClick={() => setCropEditor({ open: false, imageSrc: '', crop: { x: 0, y: 0 }, zoom: 1, pixelCrop: null, file: null })}>×</button>
            </div>

            <div className="avatar-cropper-stage">
              <Cropper
                image={cropEditor.imageSrc}
                crop={cropEditor.crop}
                zoom={cropEditor.zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={(nextCrop) => setCropEditor((current) => ({ ...current, crop: nextCrop }))}
                onCropComplete={(_, pixelCrop) => setCropEditor((current) => ({ ...current, pixelCrop }))}
                onZoomChange={(nextZoom) => setCropEditor((current) => ({ ...current, zoom: nextZoom }))}
              />
            </div>

            <div className="cropper-controls">
              <button type="button" className="control-button" onClick={() => setCropEditor((current) => ({ ...current, zoom: Math.max(1, Number((current.zoom - 0.1).toFixed(2))) }))}>−</button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={cropEditor.zoom}
                onChange={(event) => setCropEditor((current) => ({ ...current, zoom: Number(event.target.value) }))}
              />
              <button type="button" className="control-button" onClick={() => setCropEditor((current) => ({ ...current, zoom: Math.min(3, Number((current.zoom + 0.1).toFixed(2))) }))}>+</button>
            </div>

            <div className="avatar-cropper-actions">
              <button type="button" className="secondary-button" onClick={() => setCropEditor({ open: false, imageSrc: '', crop: { x: 0, y: 0 }, zoom: 1, pixelCrop: null, file: null })}>Cancel</button>
              <button type="button" className="primary-button" onClick={handleCropAndUpload} disabled={isCropping}>
                {isCropping ? 'Cropping...' : 'Apply photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Profile
