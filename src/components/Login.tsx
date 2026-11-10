
import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, authError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await signIn(email, password)

      if (result.error) {
        setError(
          result.error.includes('Invalid login credentials')
            ? 'Incorrect email or password. Please try again.'
            : result.error,
        )
      }
    } catch {
      setError('Unable to sign in. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080a12] px-5 py-12 text-slate-100">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-700/15 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[480px] w-[480px] rounded-full bg-blue-700/10 blur-[130px]" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/[0.09] bg-[#0d101b]/90 shadow-2xl shadow-black/40 lg:grid-cols-2">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-gradient-to-br from-[#15152a] via-[#111321] to-[#0b0e17] p-10 lg:flex xl:p-12">
          <div className="pointer-events-none absolute -right-24 top-28 h-64 w-64 rounded-full border border-violet-400/10" />
          <div className="pointer-events-none absolute -right-12 top-40 h-40 w-40 rounded-full border border-violet-400/10" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15 text-lg font-bold text-violet-300">
              S
            </div>
            <div>
              <p className="font-semibold tracking-wide text-white">
                SynthaxLab
              </p>
              <p className="text-xs tracking-[0.2em] text-slate-500">
                TECHNOLOGIES
              </p>
            </div>
          </div>

          <div className="relative my-16">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
              <LockKeyhole size={25} className="text-violet-300" />
            </div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
              Financial control centre
            </p>
            <h1 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight text-white">
              Clarity for every financial decision.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
              Manage company income, expenses, project finances and cash flow
              from one secure workspace.
            </p>

            <div className="mt-10 space-y-4">
              {[
                'Track business income and expenses',
                'Monitor available cash and obligations',
                'Make informed reinvestment decisions',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={15} className="text-violet-400" />
            Private workspace · Authorized access only
          </div>
        </section>

        <section className="flex min-h-[620px] flex-col justify-center p-7 sm:p-10 lg:p-12">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15 font-bold text-violet-300">
              S
            </div>
            <div>
              <p className="font-semibold text-white">SynthaxLab Finance</p>
              <p className="text-xs text-slate-500">Management workspace</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-3 text-sm font-medium text-violet-300">
              Welcome back
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Sign in to your account
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Enter your authorized credentials to continue to your financial
              dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
                Email address
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#080b13] px-4 transition focus-within:border-violet-400/60 focus-within:ring-2 focus-within:ring-violet-500/10">
                <Mail size={18} className="shrink-0 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-violet-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#080b13] px-4 transition focus-within:border-violet-400/60 focus-within:ring-2 focus-within:ring-violet-500/10">
                <LockKeyhole size={18} className="shrink-0 text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            {(error || authError) && (
              <div
                role="alert"
                className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm leading-6 text-rose-300"
              >
                {error || authError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign in securely'}
              {!submitting && (
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </form>

          <div className="mt-8 flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-violet-300" />
            <div>
              <p className="text-sm font-medium text-slate-300">
                Restricted access
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Accounts are provisioned by an administrator. Public
                registration is not available.
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-600">
            © {new Date().getFullYear()} SynthaxLab Technologies
          </p>
        </section>
      </div>
    </main>
  )
}
