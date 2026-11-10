import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReactNode } from 'react'
import Accounts from './Accounts'
import Transactions from './Transactions'
import Budgets from './Budgets'
import IncomeExpenses from './IncomeExpenses'
import Projects from './Projects'

type MetricProps = {
  label: string
  value: string
  description: string
  icon: ReactNode
  accent: string
}

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Transactions', icon: ArrowLeftRight },
  { label: 'Income', icon: ArrowDownLeft },
  { label: 'Expenses', icon: ArrowUpRight },
  { label: 'Projects', icon: BriefcaseBusiness },
  { label: 'Budgets', icon: Target },
  { label: 'Accounts', icon: Wallet },
  { label: 'Invoices', icon: FileText },
  { label: 'Reports', icon: Activity },
]

type DashboardTransaction = {
  id: string
  financial_account_id: string | null
  category_id: string | null
  type: string
  amount: number
  adjustment_direction: 'in' | 'out' | null
  transaction_date: string
  description: string | null
  created_at?: string
}

type DashboardAccount = {
  id: string
  name: string
  opening_balance: number
  is_active: boolean
}

type DashboardCategory = {
  id: string
  name: string
  type: 'income' | 'expense'
}

type DashboardBudget = {
  id: string
  category_id: string
  amount: number
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)

const monthLabel = (date: Date) =>
  date.toLocaleDateString('en-NG', { month: 'short' })

const getMonthBounds = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return {
    start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`,
  }
}

function MetricCard({
  label,
  value,
  description,
  icon,
  accent,
}: MetricProps) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5 transition hover:border-white/[0.13]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {value}
          </h3>
        </div>
        <div className={`rounded-xl p-3 ${accent}`}>{icon}</div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{description}</p>
    </article>
  )
}

function Dashboard() {
  const [activePage, setActivePage] = useState('Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [accounts, setAccounts] = useState<DashboardAccount[]>([])
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([])
  const [categories, setCategories] = useState<DashboardCategory[]>([])
  const [budgets, setBudgets] = useState<DashboardBudget[]>([])
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [overviewError, setOverviewError] = useState('')

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true)
    setOverviewError('')

    try {
      const [accountResult, transactionResult, categoryResult, budgetResult] =
        await Promise.all([
          supabase
            .from('financial_accounts')
            .select('id, name, opening_balance, is_active')
            .eq('is_active', true),
          supabase
            .from('transactions')
            .select('id, financial_account_id, category_id, type, amount, adjustment_direction, transaction_date, description, created_at')
            .order('transaction_date', { ascending: false }),
          supabase
            .from('categories')
            .select('id, name, type')
            .eq('is_active', true),
          supabase
            .from('budgets')
            .select('id, category_id, amount')
            .eq('budget_year', new Date().getFullYear())
            .eq('budget_month', new Date().getMonth() + 1),
        ])

      if (accountResult.error) throw accountResult.error
      if (transactionResult.error) throw transactionResult.error
      if (categoryResult.error) throw categoryResult.error
      if (budgetResult.error) throw budgetResult.error

      setAccounts((accountResult.data ?? []) as DashboardAccount[])
      setTransactions((transactionResult.data ?? []) as DashboardTransaction[])
      setCategories((categoryResult.data ?? []) as DashboardCategory[])
      setBudgets((budgetResult.data ?? []) as DashboardBudget[])
    } catch (err) {
      console.error('Failed to load finance overview:', err)
      setOverviewError(
        err instanceof Error
          ? err.message
          : 'Could not load the financial overview. Please try again.',
      )
    } finally {
      setLoadingOverview(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const now = new Date()
  const monthBounds = getMonthBounds(now)
  const currentMonthTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_date >= monthBounds.start &&
          transaction.transaction_date < monthBounds.end,
      ),
    [transactions, monthBounds.start, monthBounds.end],
  )

  const totalIncome = currentMonthTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

  const totalExpenses = currentMonthTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

  const availableCash = accounts.reduce((total, account) => {
    const accountTransactions = transactions.filter(
      (transaction) => transaction.financial_account_id === account.id,
    )
    const movement = accountTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.amount || 0)
      if (transaction.type === 'income' || transaction.type === 'transfer_in') return sum + amount
      if (transaction.type === 'expense' || transaction.type === 'transfer_out') return sum - amount
      if (transaction.type === 'adjustment') {
        return sum + (transaction.adjustment_direction === 'in' ? amount : -amount)
      }
      return sum
    }, 0)
    return total + Number(account.opening_balance || 0) + movement
  }, 0)

  const categoryName = (categoryId: string | null) =>
    categories.find((category) => category.id === categoryId)?.name ?? 'Uncategorised'

  const recentTransactions = transactions.slice(0, 6)

  const cashFlowData = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      const year = date.getFullYear()
      const month = date.getMonth()
      const monthTransactions = transactions.filter((transaction) => {
        const transactionDate = new Date(`${transaction.transaction_date}T00:00:00`)
        return (
          transactionDate.getFullYear() === year &&
          transactionDate.getMonth() === month
        )
      })
      return {
        month: monthLabel(date),
        income: monthTransactions
          .filter((transaction) => transaction.type === 'income')
          .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
        expenses: monthTransactions
          .filter((transaction) => transaction.type === 'expense')
          .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
      }
    })
  }, [transactions])

  const budgetOverview = budgets.map((budget) => {
    const spent = currentMonthTransactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.category_id === budget.category_id,
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
    return {
      ...budget,
      category: categoryName(budget.category_id),
      spent,
      percent: Number(budget.amount) > 0
        ? Math.min((spent / Number(budget.amount)) * 100, 100)
        : 0,
    }
  }).sort((a, b) => b.percent - a.percent)

  const closeSidebar = () => setSidebarOpen(false)

  const handleExport = () => {
    const csv = 'Date,Description,Category,Type,Amount\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'synthaxlab-finance-transactions.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#0b0d14] text-slate-100">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[0.07] bg-[#0e1018] transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[82px] items-center justify-between border-b border-white/[0.07] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-950/40">
              <CircleDollarSign size={23} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide text-white">
                SYNTHAXLAB
              </h1>
              <p className="mt-0.5 text-xs text-violet-400">FINANCE</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Workspace
          </p>
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = activePage === item.label

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setActivePage(item.label)
                    closeSidebar()
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                    active
                      ? 'bg-violet-600/15 font-medium text-violet-300 ring-1 ring-inset ring-violet-500/20'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.12] to-transparent p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <ShieldCheck size={19} />
            </div>
            <p className="text-sm font-medium text-white">Financial workspace</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Private company finance management.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Setup incomplete
            </div>
          </div>

          <button
            onClick={() => setActivePage('Settings')}
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-white"
          >
            <Settings size={18} />
            Settings
          </button>

          <div className="mt-3 border-t border-white/[0.07] pt-4">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-700 text-sm font-semibold text-white">
                SA
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  SynthaxLab Admin
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Founder</p>
              </div>
              <ChevronDown size={15} className="text-slate-500" />
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-[82px] items-center justify-between border-b border-white/[0.07] bg-[#0b0d14]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={21} />
            </button>
            <div>
              <p className="text-xs text-slate-500">SynthaxLab Technologies</p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                {activePage}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-400 md:flex">
              <CalendarDays size={15} />
              <span>{now.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}</span>
              <ChevronDown size={14} />
            </div>

            <button
              aria-label="Search"
              className="rounded-xl border border-white/[0.08] p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <Search size={18} />
            </button>

            <button
              aria-label="Notifications"
              className="relative rounded-xl border border-white/[0.08] p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-400" />
            </button>

            <button
              onClick={() => setActivePage('Transactions')}
              className="hidden items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500 sm:flex"
            >
              <Plus size={17} />
              Add transaction
            </button>
          </div>
        </header>

{activePage === 'Transactions' ? (
  <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
    <Transactions />
  </div>
) : activePage === 'Accounts' ? (
  <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
    <Accounts />
  </div>
  ) : activePage === 'Income' ? (
  <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
    <IncomeExpenses type="income" />
  </div>
) : activePage === 'Expenses' ? (
  <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
    <IncomeExpenses type="expense" />
  </div>
) : activePage === 'Projects' ? (
  <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
    <Projects />
  </div>
) : activePage === 'Budgets' ? (<Budgets />) :activePage === 'Overview' ? (
  <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                overviewError
                  ? 'border-rose-500/20 bg-rose-500/[0.06] text-rose-300'
                  : loadingOverview
                    ? 'border-amber-500/15 bg-amber-500/[0.06] text-amber-300'
                    : 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  overviewError ? 'bg-rose-400' : loadingOverview ? 'bg-amber-400' : 'bg-emerald-400'
                }`} />
                {overviewError ? 'Unable to load financial data' : loadingOverview ? 'Syncing financial data' : 'Live financial overview'}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Financial overview
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Monitor your business finances, manage cash flow, and plan
                your next move with confidence.
              </p>
            </div>

            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/[0.09] px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.04] sm:self-auto"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Available cash"
              value={loadingOverview ? '—' : formatMoney(availableCash)}
              description={`${accounts.length} active financial account${accounts.length === 1 ? '' : 's'}`}
              icon={<Wallet size={20} />}
              accent="bg-violet-500/10 text-violet-300"
            />
            <MetricCard
              label="Revenue earned"
              value={loadingOverview ? '—' : formatMoney(totalIncome)}
              description="Income recorded this month" 
              icon={<TrendingUp size={20} />}
              accent="bg-sky-500/10 text-sky-300"
            />
            <MetricCard
              label="Total expenses"
              value={loadingOverview ? '—' : formatMoney(totalExpenses)}
              description="Expenses recorded this month" 
              icon={<CreditCard size={20} />}
              accent="bg-rose-500/10 text-rose-300"
            />
            <MetricCard
              label="Net cash flow"
              value={loadingOverview ? '—' : formatMoney(totalIncome - totalExpenses)}
              description="Income minus expenses this month"
              icon={<TrendingUp size={20} />}
              accent="bg-amber-500/10 text-amber-300" 
            />
          </div>

          <div className="mb-7 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5 sm:p-6 xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">Cash flow</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Income and expenses over time
                  </p>
                </div>
                <button className="flex items-center gap-2 rounded-lg border border-white/[0.07] px-3 py-2 text-xs text-slate-400">
                  Monthly <ChevronDown size={13} />
                </button>
              </div>

              <div className="h-[260px] w-full pt-5">
                {loadingOverview ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Loading cash flow…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => value >= 1000000 ? `₦${(value / 1000000).toFixed(1)}m` : value >= 1000 ? `₦${(value / 1000).toFixed(0)}k` : `₦${value}`} />
                      <Tooltip
                        contentStyle={{ background: '#12151f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e2e8f0' }}
                        formatter={(value) => formatMoney(Number(value ?? 0))}
                      />
                      <Bar dataKey="income" name="Income" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {overviewError && (
                <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-xs text-rose-300">
                  {overviewError}
                </p>
              )}

              <div className="flex items-center gap-6 border-t border-white/[0.06] pt-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-violet-400" />
                  Income
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  Expenses
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Budget overview</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Current monthly allocation
                  </p>
                </div>
                <Target size={19} className="text-violet-300" />
              </div>

              <div className="min-h-[180px] space-y-4 py-5">
                {loadingOverview ? (
                  <p className="py-10 text-center text-sm text-slate-500">Loading budgets…</p>
                ) : budgetOverview.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-violet-400/30 text-violet-300">
                      <Target size={21} />
                    </div>
                    <p className="text-sm font-medium text-slate-200">No budget created</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Create a monthly category budget to track spending here.
                    </p>
                  </div>
                ) : budgetOverview.slice(0, 3).map((budget) => (
                  <div key={budget.id}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-slate-300">{budget.category}</span>
                      <span className={budget.spent > Number(budget.amount) ? 'shrink-0 text-rose-300' : 'shrink-0 text-slate-400'}>
                        {formatMoney(budget.spent)} / {formatMoney(Number(budget.amount))}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${budget.spent > Number(budget.amount) ? 'bg-rose-400' : budget.percent >= 80 ? 'bg-amber-300' : 'bg-violet-400'}`}
                        style={{ width: `${Math.min(budget.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setActivePage('Budgets')}
                className="w-full rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-4 py-3 text-sm font-medium text-violet-300 transition hover:bg-violet-500/[0.12]"
              >
                Open budget planner
              </button>
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#12151f]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-5 sm:px-6">
              <div>
                <h3 className="font-semibold text-white">Recent transactions</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Your latest recorded financial activity
                </p>
              </div>
              <button
                onClick={() => setActivePage('Transactions')}
                className="text-xs font-medium text-violet-300 hover:text-violet-200"
              >
                View all
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-white/[0.015]">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4 font-medium">Transaction</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {loadingOverview ? (
                    <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">Loading transactions…</td></tr>
                  ) : recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center">
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.03] text-slate-500">
                          <ArrowLeftRight size={20} />
                        </div>
                        <p className="text-sm text-slate-300">No transactions recorded yet</p>
                        <p className="mt-1 text-xs text-slate-500">Record a transaction to see financial activity here.</p>
                      </td>
                    </tr>
                  ) : recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="text-sm">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-200">{transaction.description || 'Financial transaction'}</p>
                        <p className="mt-1 text-xs capitalize text-slate-500">{transaction.type.replace('_', ' ')}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{categoryName(transaction.category_id)}</td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(`${transaction.transaction_date}T00:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className={`px-6 py-4 text-right font-medium tabular-nums ${transaction.type === 'income' || transaction.type === 'transfer_in' ? 'text-emerald-300' : transaction.type === 'expense' || transaction.type === 'transfer_out' ? 'text-rose-300' : 'text-slate-200'}`}>
                        {transaction.type === 'income' || transaction.type === 'transfer_in' ? '+' : transaction.type === 'expense' || transaction.type === 'transfer_out' ? '−' : ''}
                        {formatMoney(Number(transaction.amount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-white/[0.06] pt-5 text-xs text-slate-600 sm:flex-row">
            <p>SynthaxLab Finance · Internal financial management</p>
            <p>Supabase-connected financial records · Refresh the page to sync</p>
          </footer>
          </div>
) : (
  <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
    <section className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-white">{activePage}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        This section is not implemented yet. Your financial records will be
        connected as we build this module.
      </p>
      <button
        onClick={() => setActivePage('Overview')}
        className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
      >
        Return to Overview
      </button>
    </section>
  </div>
)}
      </main>

    </div>
  )
}

export default Dashboard