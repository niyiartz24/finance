
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type AppRole =
  | 'founder'
  | 'financial_officer'
  | 'team_member'

export interface UserProfile {
  id: string
  full_name: string
  role: AppRole
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  authError: string | null
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadProfile(userId: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', userId)
        .maybeSingle()

      if (!active) return

      if (error) {
        setProfile(null)
        setAuthError(`Unable to load your profile: ${error.message}`)
        return
      }

      if (!data) {
        setProfile(null)
        setAuthError(
          'Your profile was not found. Please contact the system administrator.',
        )
        return
      }

      setProfile(data as UserProfile)
      setAuthError(null)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession?.user) {
        setProfile(null)
        setAuthError(null)
        setLoading(false)
        return
      }

      // Defer the database query until after the auth callback.
      Promise.resolve().then(() => {
        if (active && nextSession.user) {
          void loadProfile(nextSession.user.id).finally(() => {
            if (active) setLoading(false)
          })
        }
      })
    })

    void supabase.auth.getSession().then(
      async ({ data, error }) => {
        if (!active) return

        if (error) {
          setAuthError(error.message)
          setLoading(false)
          return
        }

        setSession(data.session)
        setUser(data.session?.user ?? null)

        if (data.session?.user) {
          await loadProfile(data.session.user.id)
        } else {
          setProfile(null)
        }

        if (active) setLoading(false)
      },
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    return { error: error?.message ?? null }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    return { error: error?.message ?? null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        authError,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
