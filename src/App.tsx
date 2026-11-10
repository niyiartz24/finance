import Login from './components/Login'
import Dashboard from './components/Dashboard'
import { useAuth } from './contexts/AuthContext'


export default function App() {
  const { user, profile, loading, authError, signOut } = useAuth()
  

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080a12] text-slate-300">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-400" />
          <p className="text-sm">Securing your workspace...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Login />
  }

  if (authError || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080a12] px-5 text-slate-100">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[#111421] p-7">
          <h1 className="text-xl font-semibold">Profile unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {authError || 'Your account profile could not be loaded.'}
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Sign out
          </button>
        </div>
      </main>
    )
  }

return (
  <div className="min-h-screen bg-[#0b0d14]">
    <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#0d101b] px-5 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-200">
          {profile.full_name}
        </p>
        <p className="text-xs capitalize text-slate-500">
          {profile.role.replace('_', ' ')}
        </p>
      </div>

      <button
        onClick={() => void signOut()}
        className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-slate-300 transition hover:bg-white/5"
      >
        Sign out
      </button>
    </div>

    <Dashboard />
  </div>
)
}