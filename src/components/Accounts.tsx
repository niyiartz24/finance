import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Wallet,
  Plus,
  Search,
  RefreshCw,
  X,
  Landmark,
  Banknote,
  CreditCard,
  Smartphone,
  MoreHorizontal,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

type AccountType =
  | 'bank'
  | 'cash'
  | 'payment_gateway'
  | 'digital_wallet'
  | 'other'

interface FinancialAccount {
  id: string
  name: string
  account_type: AccountType
  institution: string | null
  currency: string
  opening_balance: number
  opening_balance_date: string
  is_active: boolean
  notes: string | null
  created_at: string
}

interface AccountBalance {
  account_id: string
  current_balance: number
}

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'bank', label: 'Bank account' },
  { value: 'cash', label: 'Cash' },
  { value: 'payment_gateway', label: 'Payment gateway' },
  { value: 'digital_wallet', label: 'Digital wallet' },
  { value: 'other', label: 'Other' },
]

function getAccountIcon(type: AccountType) {
  switch (type) {
    case 'bank':
      return Landmark
    case 'cash':
      return Banknote
    case 'payment_gateway':
      return CreditCard
    case 'digital_wallet':
      return Smartphone
    default:
      return Wallet
  }
}

function formatMoney(amount: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function today() {
  const date = new Date()
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  )
  return localDate.toISOString().slice(0, 10)
}

export default function Accounts() {
  const { profile } = useAuth()

  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] =
    useState<FinancialAccount | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    name: '',
    account_type: 'bank' as AccountType,
    institution: '',
    currency: 'NGN',
    opening_balance: '0',
    opening_balance_date: today(),
    notes: '',
  })

  const canManage =
    profile?.role === 'founder' ||
    profile?.role === 'financial_officer'

  const fetchAccounts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const { data, error: accountError } = await supabase
        .from('financial_accounts')
        .select(
          'id, name, account_type, institution, currency, opening_balance, opening_balance_date, is_active, notes, created_at',
        )
        .order('created_at', { ascending: false })

      if (accountError) throw accountError

      const accountRows = (data ?? []) as FinancialAccount[]
      setAccounts(accountRows)

      if (accountRows.length > 0) {
        const { data: balanceRows, error: balanceError } = await supabase
          .from('account_balances')
          .select('account_id, current_balance')

        if (balanceError) throw balanceError

        const balanceMap: Record<string, number> = {}

        for (const row of (balanceRows ?? []) as AccountBalance[]) {
          balanceMap[row.account_id] = Number(row.current_balance)
        }

        setBalances(balanceMap)
      } else {
        setBalances({})
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.'

      setError(
        `Unable to load accounts. ${message}`,
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchAccounts()
  }, [fetchAccounts])

  function resetForm() {
    setForm({
      name: '',
      account_type: 'bank',
      institution: '',
      currency: 'NGN',
      opening_balance: '0',
      opening_balance_date: today(),
      notes: '',
    })
    setEditingAccount(null)
  }

  function openCreateModal() {
    resetForm()
    setError('')
    setSuccess('')
    setModalOpen(true)
  }

  function openEditModal(account: FinancialAccount) {
    setEditingAccount(account)
    setForm({
      name: account.name,
      account_type: account.account_type,
      institution: account.institution ?? '',
      currency: account.currency,
      opening_balance: String(account.opening_balance),
      opening_balance_date: account.opening_balance_date,
      notes: account.notes ?? '',
    })
    setError('')
    setSuccess('')
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!canManage) {
      setError('You do not have permission to manage financial accounts.')
      return
    }

    const openingBalance = Number(form.opening_balance)

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setError('Enter a valid opening balance of zero or more.')
      return
    }

    if (!form.name.trim()) {
      setError('Account name is required.')
      return
    }

    const payload = {
      name: form.name.trim(),
      account_type: form.account_type,
      institution: form.institution.trim() || null,
      currency: form.currency,
      opening_balance: openingBalance,
      opening_balance_date: form.opening_balance_date,
      notes: form.notes.trim() || null,
    }

    try {
      if (editingAccount) {
        // Prevent accidental changes to an opening balance after
        // transactions have been entered.
        if (
          openingBalance !== Number(editingAccount.opening_balance) ||
          form.opening_balance_date !== editingAccount.opening_balance_date
        ) {
          const { count, error: countError } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('financial_account_id', editingAccount.id)

          if (countError) throw countError

          if ((count ?? 0) > 0) {
            setError(
              'This account already has transactions. Its opening balance and opening date cannot be changed here. Keep the original values; we will add a controlled balance-correction workflow later.',
            )
            return
          }
        }

        const { error: updateError } = await supabase
          .from('financial_accounts')
          .update(payload)
          .eq('id', editingAccount.id)

        if (updateError) throw updateError

        setSuccess('Account updated successfully.')
      } else {
        const { error: insertError } = await supabase
          .from('financial_accounts')
          .insert({
            ...payload,
            created_by: profile?.id,
          })

        if (insertError) throw insertError

        setSuccess('Account created successfully.')
      }

      setModalOpen(false)
      resetForm()
      await fetchAccounts(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save this account.',
      )
    }
  }

  async function toggleAccount(account: FinancialAccount) {
    if (!canManage) return

    const message = account.is_active
      ? `Deactivate "${account.name}"? Existing financial history will be preserved.`
      : `Reactivate "${account.name}"?`

    if (!window.confirm(message)) return

    setError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from('financial_accounts')
      .update({ is_active: !account.is_active })
      .eq('id', account.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(
      account.is_active
        ? 'Account deactivated.'
        : 'Account reactivated.',
    )

    await fetchAccounts(true)
  }

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = [
      account.name,
      account.institution ?? '',
      accountTypes.find((item) => item.value === account.account_type)
        ?.label ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchesStatus =
      filter === 'all' ||
      (filter === 'active' && account.is_active) ||
      (filter === 'inactive' && !account.is_active)

    return matchesSearch && matchesStatus
  })

  const activeAccounts = accounts.filter((account) => account.is_active)
  const activeTotal = activeAccounts.reduce(
    (total, account) =>
      total + (balances[account.id] ?? Number(account.opening_balance)),
    0,
  )

  const activeCurrencies = new Set(
    activeAccounts.map((account) => account.currency),
  )

  return (
    <div className="min-h-screen bg-[#0b0d14] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
              Financial management
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Financial accounts
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Manage the accounts that hold SynthaxLab Technologies' funds.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void fetchAccounts(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={refreshing ? 'animate-spin' : ''}
              />
              Refresh
            </button>

            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/20 transition hover:bg-violet-500"
              >
                <Plus size={17} />
                Add account
              </button>
            )}
          </div>
        </div>

        {error && !modalOpen && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-300"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-300"
          >
            {success}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111421] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Active accounts</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {activeAccounts.length}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Of {accounts.length} total accounts
                </p>
              </div>
              <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.08] p-3">
                <Wallet size={21} className="text-violet-300" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#111421] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">
                  Combined active balance
                </p>
                <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {activeCurrencies.size <= 1
                    ? formatMoney(
                        activeTotal,
                        activeAccounts[0]?.currency ?? 'NGN',
                      )
                    : 'Multiple currencies'}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Calculated from opening balances and recorded transactions
                </p>
              </div>
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.08] p-3">
                <Banknote size={21} className="text-emerald-300" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#111421] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search accounts..."
              aria-label="Search accounts"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d14] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'inactive'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium capitalize transition ${
                  filter === value
                    ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111421]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold text-white">Your accounts</h2>
              <p className="mt-1 text-xs text-slate-500">
                {filteredAccounts.length} account
                {filteredAccounts.length === 1 ? '' : 's'} displayed
              </p>
            </div>
            <Wallet size={19} className="text-slate-500" />
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-400">
              <RefreshCw size={17} className="mr-3 animate-spin" />
              Loading financial accounts...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <Wallet size={24} className="text-slate-500" />
              </div>

              <h3 className="text-base font-semibold text-white">
                {accounts.length === 0
                  ? 'No financial accounts yet'
                  : 'No matching accounts'}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                {accounts.length === 0
                  ? 'Create your first account to start tracking where your company funds are held.'
                  : 'Try another search term or change the status filter.'}
              </p>

              {accounts.length === 0 && canManage && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  <Plus size={16} />
                  Create your first account
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filteredAccounts.map((account) => {
                const Icon = getAccountIcon(account.account_type)
                const balance =
                  balances[account.id] ?? Number(account.opening_balance)

                return (
                  <div
                    key={account.id}
                    className="flex flex-col gap-4 px-5 py-5 transition hover:bg-white/[0.015] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/[0.07]">
                        <Icon size={21} className="text-violet-300" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-medium text-white">
                            {account.name}
                          </h3>
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                              account.is_active
                                ? 'bg-emerald-400/10 text-emerald-300'
                                : 'bg-slate-500/15 text-slate-400'
                            }`}
                          >
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-400">
                          {
                            accountTypes.find(
                              (item) =>
                                item.value === account.account_type,
                            )?.label
                          }
                          {account.institution
                            ? ` · ${account.institution}`
                            : ''}
                        </p>

                        <p className="mt-2 text-xs text-slate-500">
                          Opening balance:{' '}
                          {formatMoney(
                            Number(account.opening_balance),
                            account.currency,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="sm:text-right">
                        <p className="text-xs text-slate-500">
                          Current balance
                        </p>
                        <p
                          className={`mt-1 text-lg font-semibold ${
                            balance < 0
                              ? 'text-rose-300'
                              : 'text-white'
                          }`}
                        >
                          {formatMoney(balance, account.currency)}
                        </p>
                      </div>

                      {canManage && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(account)}
                            aria-label={`Edit ${account.name}`}
                            title="Edit account"
                            className="rounded-lg border border-white/10 p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                          >
                            <MoreHorizontal size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() => void toggleAccount(account)}
                            aria-label={
                              account.is_active
                                ? `Deactivate ${account.name}`
                                : `Reactivate ${account.name}`
                            }
                            title={
                              account.is_active
                                ? 'Deactivate account'
                                : 'Reactivate account'
                            }
                            className="rounded-lg border border-white/10 p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                          >
                            {account.is_active ? (
                              <ArrowDownRight size={17} />
                            ) : (
                              <ArrowUpRight size={17} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Balances are calculated from the opening balance and recorded
          transactions. Accounts in different currencies should be reviewed
          separately; their balances are not converted into a single currency.
        </p>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false)
              resetForm()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            className="my-auto w-full max-w-xl rounded-2xl border border-white/10 bg-[#111421] shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <div>
                <h2
                  id="account-modal-title"
                  className="text-lg font-semibold text-white"
                >
                  {editingAccount ? 'Edit account' : 'Add financial account'}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Enter the details for this company-held account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalOpen(false)
                  resetForm()
                }}
                aria-label="Close account form"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-sm leading-6 text-rose-300"
                >
                  <AlertCircle size={17} className="mt-1 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="account-name"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Account name *
                </label>
                <input
                  id="account-name"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Business Bank Account"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="account-type"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Account type *
                  </label>
                  <select
                    id="account-type"
                    value={form.account_type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        account_type: event.target.value as AccountType,
                      })
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                  >
                    {accountTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="account-currency"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Currency *
                  </label>
                  <select
                    id="account-currency"
                    value={form.currency}
                    onChange={(event) =>
                      setForm({ ...form, currency: event.target.value })
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                  >
                    <option value="NGN">NGN — Nigerian naira</option>
                    <option value="USD">USD — US dollar</option>
                    <option value="GBP">GBP — British pound</option>
                    <option value="EUR">EUR — Euro</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="account-institution"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Institution or provider
                </label>
                <input
                  id="account-institution"
                  maxLength={120}
                  value={form.institution}
                  onChange={(event) =>
                    setForm({ ...form, institution: event.target.value })
                  }
                  placeholder="e.g. Bank or payment provider"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="opening-balance"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Opening balance *
                  </label>
                  <input
                    id="opening-balance"
                    type="number"
                    min="0"
                    max="9999999999999999"
                    step="0.01"
                    required
                    value={form.opening_balance}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        opening_balance: event.target.value,
                      })
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-4 text-sm text-white outline-none focus:border-violet-400/50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="opening-date"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Balance as of *
                  </label>
                  <input
                    id="opening-date"
                    type="date"
                    required
                    value={form.opening_balance_date}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        opening_balance_date: event.target.value,
                      })
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="account-notes"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Notes
                </label>
                <textarea
                  id="account-notes"
                  rows={3}
                  maxLength={1000}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Optional account details"
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
                />
              </div>

              {editingAccount && (
                <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-xs leading-5 text-amber-200/80">
                  Opening balances establish the starting point for all
                  subsequent transactions. Once transactions exist, the
                  opening balance and date are locked in this form to protect
                  your financial history.
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false)
                    resetForm()
                  }}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  {editingAccount ? 'Save changes' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}