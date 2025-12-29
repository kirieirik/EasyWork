import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setOrganization(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    console.log('Fetching profile for user:', userId)
    
    try {
      console.log('Starting Supabase query...')
      
      // Wrap query in a timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 5000)
      )
      
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)

      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

      console.log('Profile query result:', data, error)

      if (error) {
        console.error('Profile error:', error)
        setLoading(false)
        return
      }

      const profileData = data?.[0]
      
      if (!profileData) {
        console.log('No profile found for user')
        setLoading(false)
        return
      }

      setProfile(profileData)

      // Then fetch organization separately
      if (profileData?.organization_id) {
        console.log('Fetching organization:', profileData.organization_id)
        
        const orgQueryPromise = supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.organization_id)
          
        const { data: orgData, error: orgError } = await Promise.race([orgQueryPromise, timeoutPromise])

        console.log('Organization result:', orgData, orgError)

        if (!orgError && orgData?.[0]) {
          setOrganization(orgData[0])
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error.message)
    } finally {
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
