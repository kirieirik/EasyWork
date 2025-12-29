import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let hasFetched = false

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted || hasFetched) return
      hasFetched = true
      
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.access_token)
      } else {
        setLoading(false)
      }
    }).catch(err => {
      console.error('Session error:', err)
      if (isMounted) setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        
        // Skip INITIAL_SESSION as we handle it above
        if (event === 'INITIAL_SESSION') return
        
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id, session.access_token)
        } else {
          setProfile(null)
          setOrganization(null)
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId, accessToken) {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );
      
      const profiles = await response.json();
      const data = profiles?.[0];

      if (!data) {
        setLoading(false)
        return
      }

      setProfile(data)

      if (data?.organization_id) {
        const orgResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/organizations?id=eq.${data.organization_id}&select=*`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );
        
        const orgs = await orgResponse.json();

        if (orgs?.[0]) {
          setOrganization(orgs[0])
        }
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  async function signUp(email, password, metadata) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    return { data, error }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  async function resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { data, error }
  }

  const value = {
    user,
    profile,
    organization,
    setOrganization,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isAdmin: profile?.role === 'admin',
    isOwner: profile?.role === 'owner'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
