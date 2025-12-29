import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './AcceptInvitation.module.css'

export default function AcceptInvitation() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('loading') // loading, register, login, success, error
  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    checkInvitation()
  }, [token])

  const checkInvitation = async () => {
    try {
      // Fetch invitation details
      const { data: inv, error: invError } = await supabase
        .from('invitations')
        .select(`
          *,
          organizations(name)
        `)
        .eq('token', token)
        .single()

      if (invError || !inv) {
        setStep('error')
        setError('Invitasjonen er ugyldig eller finnes ikke.')
        setLoading(false)
        return
      }

      // Check if expired
      if (new Date(inv.expires_at) < new Date()) {
        setStep('error')
        setError('Denne invitasjonen har utløpt. Be om en ny invitasjon.')
        setLoading(false)
        return
      }

      // Check if already accepted
      if (inv.status === 'accepted') {
        setStep('error')
        setError('Denne invitasjonen er allerede brukt.')
        setLoading(false)
        return
      }

      setInvitation(inv)

      // Check if user already exists
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', inv.email)
        .limit(1)

      if (existingUsers && existingUsers.length > 0) {
        setStep('login')
      } else {
        setStep('register')
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Error checking invitation:', err)
      setStep('error')
      setError('Kunne ikke hente invitasjonsdetaljer.')
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError('Passordene stemmer ikke overens.')
      setSubmitting(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Passordet må være minst 6 tegn.')
      setSubmitting(false)
      return
    }

    try {
      // Register user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName
          }
        }
      })

      if (signUpError) throw signUpError

      // Accept invitation (this will add user to org_users)
      const { error: acceptError } = await supabase.rpc('accept_invitation', {
        invitation_token: token
      })

      if (acceptError) throw acceptError

      // Update profile with full name
      if (authData.user) {
        await supabase
          .from('profiles')
          .update({ full_name: formData.fullName })
          .eq('id', authData.user.id)
      }

      setStep('success')
    } catch (err) {
      console.error('Registration error:', err)
      setError(err.message || 'Kunne ikke fullføre registreringen.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Login user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: formData.password
      })

      if (signInError) throw signInError

      // Accept invitation
      const { error: acceptError } = await supabase.rpc('accept_invitation', {
        invitation_token: token
      })

      if (acceptError) throw acceptError

      setStep('success')
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Kunne ikke logge inn.')
    } finally {
      setSubmitting(false)
    }
  }

  const goToDashboard = () => {
    navigate('/', { replace: true })
    window.location.reload() // Refresh to update auth context
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>
            <svg className={styles.spinner} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4m-8-10h4m12 0h4m-2.636-7.364l-2.828 2.828m-8.486 8.486l-2.828 2.828m14.142 0l-2.828-2.828m-8.486-8.486L4.636 4.636"/>
            </svg>
            <p>Laster invitasjon...</p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h2>Invitasjon ugyldig</h2>
            <p>{error}</p>
            <button className={styles.primaryBtn} onClick={() => navigate('/login')}>
              Gå til innlogging
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <h2>Velkommen til {invitation?.organizations?.name}!</h2>
            <p>Du er nå medlem av organisasjonen og kan begynne å bruke EasyWork.</p>
            <button className={styles.primaryBtn} onClick={goToDashboard}>
              Gå til dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <h1>Bli med i {invitation?.organizations?.name}</h1>
          <p className={styles.subtitle}>
            Du har blitt invitert som <strong>{invitation?.role === 'admin' ? 'Administrator' : 'Ansatt'}</strong>
          </p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegister} className={styles.form}>
            <p className={styles.formInfo}>
              Opprett en konto for å godta invitasjonen.
            </p>

            <div className={styles.formGroup}>
              <label>E-post</label>
              <input
                type="email"
                value={invitation?.email || ''}
                disabled
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Fullt navn</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Ola Nordmann"
                required
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Passord</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minst 6 tegn"
                required
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Bekreft passord</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Skriv passordet på nytt"
                required
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? (
                <>
                  <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4m-8-10h4m12 0h4"/>
                  </svg>
                  Oppretter konto...
                </>
              ) : (
                'Opprett konto og bli med'
              )}
            </button>
          </form>
        )}

        {step === 'login' && (
          <form onSubmit={handleLogin} className={styles.form}>
            <p className={styles.formInfo}>
              Du har allerede en konto. Logg inn for å godta invitasjonen.
            </p>

            <div className={styles.formGroup}>
              <label>E-post</label>
              <input
                type="email"
                value={invitation?.email || ''}
                disabled
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Passord</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Ditt passord"
                required
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? (
                <>
                  <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4m-8-10h4m12 0h4"/>
                  </svg>
                  Logger inn...
                </>
              ) : (
                'Logg inn og bli med'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
