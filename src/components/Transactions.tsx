
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type TransactionType = 'income' | 'expense'

type FinancialAccount = {
  id: string
  name: string
  is_active: boolean
}

type Category = {
  id: string
  name: string
  type: TransactionType
  is_active: boolean
}

type Project = {
  id: string
  name: string
}

type Transaction = {
  id: string
  financial_account_id: string
  category_id: string
  project_id: string | null
  type: TransactionType
  amount: number
  transaction_date: string
  description: string
  counterparty: string | null
  reference: string | null
  notes: string | null
}

const today = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount)

const inputClass =
  'mt-2 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500'

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | TransactionType>('all')
  const [showForm, setShowForm] = useState(false)

  const [type, setType] = useState<TransactionType>('income')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [transactionResult, accountResult, categoryResult, projectResult] =
        await Promise.all([
          supabase
            .from('transactions')
            .select(
              'id, financial_account_id, category_id, project_id, type, amount, transaction_date, description, counterparty, reference, notes',
            )
            .in('type', ['income', 'expense'])
            .order('transaction_date', { ascending: false }),

          supabase
            .from('financial_accounts')
            .select('id, name, is_active')
            .order('name'),

          supabase
            .from('categories')
            .select('id, name, type, is_active')
            .eq('is_active', true)
            .order('name'),

          supabase
            .from('projects')
            .select('id, name')
            .order('name'),
        ])

      if (transactionResult.error) throw transactionResult.error
      if (accountResult.error) throw accountResult.error
      if (categoryResult.error) throw categoryResult.error
      if (projectResult.error) throw projectResult.error

      setTransactions((transactionResult.data ?? []) as Transaction[])
      setAccounts((accountResult.data ?? []) as FinancialAccount[])
      setCategories((categoryResult.data ?? []) as Category[])
      setProjects((projectResult.data ?? []) as Project[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load financial records.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  )

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()

    return transactions.filter((transaction) => {
      const matchesType = filter === 'all' || transaction.type === filter

      const categoryName =
        categories.find((item) => item.id === transaction.category_id)?.name ??
        ''

      const accountName =
        accounts.find((item) => item.id === transaction.financial_account_id)?.name ?? ''

      const matchesSearch =
        !query ||
        transaction.description.toLowerCase().includes(query) ||
        categoryName.toLowerCase().includes(query) ||
        accountName.toLowerCase().includes(query) ||
        (transaction.counterparty ?? '').toLowerCase().includes(query) ||
        (transaction.reference ?? '').toLowerCase().includes(query)

      return matchesType && matchesSearch
    })
  }, [transactions, filter, search, categories, accounts])

  const incomeTotal = filteredTransactions
    .filter((item) => item.type === 'income')
    .reduce((total, item) => total + Number(item.amount), 0)

  const expenseTotal = filteredTransactions
    .filter((item) => item.type === 'expense')
    .reduce((total, item) => total + Number(item.amount), 0)

  const resetForm = () => {
    setType('income')
    setAmount('')
    setAccountId('')
    setCategoryId('')
    setProjectId('')
    setDate(today())
    setDescription('')
    setCounterparty('')
    setReference('')
    setNotes('')
    setError('')
  }

  const changeType = (nextType: TransactionType) => {
    setType(nextType)
    setCategoryId('')
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const numericAmount = Number(amount)

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    if (!accountId || !categoryId || !description.trim() || !date) {
      setError('Complete all required fields before saving.')
      return
    }

    const selectedAccount = accounts.find((item) => item.id === accountId)
    if (!selectedAccount?.is_active) {
      setError('Choose an active financial account.')
      return
    }

    try {
      setSaving(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('Your session has expired. Please sign in again.')

      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          financial_account_id: accountId,
          category_id: categoryId,
          project_id: projectId || null,
          type,
          amount: numericAmount,
          transaction_date: date,
          description: description.trim(),
          counterparty: counterparty.trim() || null,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          source: 'manual',
          created_by: user.id,
        })

      if (insertError) throw insertError

      setShowForm(false)
      resetForm()
      setSuccess('Transaction saved successfully.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save this transaction.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-violet-300">
            Financial activity
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Transactions
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Record and review the money moving through SynthaxLab Technologies.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          <Plus size={17} />
          Add transaction
        </button>
      </div>

      {error && !showForm && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm text-emerald-300">
          <CheckCircle2 size={17} />
          {success}
          <button
            onClick={() => setSuccess('')}
            className="ml-auto text-emerald-200"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Income in results</p>
            <ArrowDownLeft size={19} className="text-emerald-300" />
          </div>
          <p className="mt-4 text-xl font-semibold text-white">
            {formatMoney(incomeTotal)}
          </p>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Expenses in results</p>
            <ArrowUpRight size={19} className="text-rose-300" />
          </div>
          <p className="mt-4 text-xl font-semibold text-white">
            {formatMoney(expenseTotal)}
          </p>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Net movement</p>
            <CircleDollarSign size={19} className="text-violet-300" />
          </div>
          <p
            className={`mt-4 text-xl font-semibold ${
              incomeTotal - expenseTotal < 0
                ? 'text-rose-300'
                : 'text-white'
            }`}
          >
            {formatMoney(incomeTotal - expenseTotal)}
          </p>
        </article>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#12151f]">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-white">Transaction history</h2>
            <p className="mt-1 text-xs text-slate-500">
              {filteredTransactions.length} matching records
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0d14] px-3">
              <Search size={16} className="shrink-0 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transactions..."
                className="min-w-0 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600 sm:w-56"
              />
            </div>

            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as 'all' | TransactionType)
              }
              className="rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-3 text-sm text-slate-300 outline-none"
              aria-label="Filter transactions"
            >
              <option value="all">All transactions</option>
              <option value="income">Income only</option>
              <option value="expense">Expenses only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-slate-400">
            <LoaderCircle size={19} className="animate-spin" />
            Loading financial records...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/[0.08] text-violet-300">
              <CircleDollarSign size={25} />
            </div>
            <h3 className="font-medium text-slate-200">
              {search || filter !== 'all'
                ? 'No matching transactions'
                : 'No transactions recorded yet'}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {search || filter !== 'all'
                ? 'Try changing your search or filter.'
                : 'Once you record business income or expenses, they will appear here.'}
            </p>
            {!search && filter === 'all' && (
              <button
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
                className="mt-5 rounded-xl border border-violet-500/20 px-4 py-2.5 text-sm text-violet-300 hover:bg-violet-500/10"
              >
                Record your first transaction
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-white/[0.02]">
                <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-medium">Description</th>
                  <th className="px-5 py-4 font-medium">Category</th>
                  <th className="px-5 py-4 font-medium">Account</th>
                  <th className="px-5 py-4 font-medium">Date</th>
                  <th className="px-5 py-4 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredTransactions.map((transaction) => {
                  const category = categories.find(
                    (item) => item.id === transaction.category_id,
                  )
                  const account = accounts.find(
                    (item) => item.id === transaction.financial_account_id,
                  )

                  return (
                    <tr key={transaction.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-200">
                          {transaction.description}
                        </p>
                        {transaction.counterparty && (
                          <p className="mt-1 text-xs text-slate-500">
                            {transaction.counterparty}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {category?.name ?? 'Category unavailable'}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {account?.name ?? 'Account unavailable'}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {new Date(
                          `${transaction.transaction_date}T00:00:00`,
                        ).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td
                        className={`px-5 py-4 text-right text-sm font-semibold ${
                          transaction.type === 'income'
                            ? 'text-emerald-300'
                            : 'text-rose-300'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatMoney(Number(transaction.amount))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#141722] p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Add transaction
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Enter an accurate record of business activity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setError('')
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1">
              <button
                type="button"
                onClick={() => changeType('income')}
                className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm ${
                  type === 'income'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft size={17} />
                Income
              </button>
              <button
                type="button"
                onClick={() => changeType('expense')}
                className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm ${
                  type === 'expense'
                    ? 'bg-rose-500/15 text-rose-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpRight size={17} />
                Expense
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                Amount (NGN) *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="e.g. 7500"
                  className={inputClass}
                />
              </label>

              <label className="text-sm text-slate-300">
                Transaction date *
                <span className="relative block">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute right-3 top-5 text-slate-500"
                  />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={inputClass}
                  />
                </span>
              </label>

              <label className="text-sm text-slate-300 sm:col-span-2">
                Description *
                <input
                  required
                  maxLength={200}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={
                    type === 'income'
                      ? 'e.g. Website development payment'
                      : 'e.g. Monthly database hosting'
                  }
                  className={inputClass}
                />
              </label>

              <label className="text-sm text-slate-300">
                Financial account *
                <select
                  required
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select account</option>
                  {accounts
                    .filter((account) => account.is_active)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
                {accounts.filter((account) => account.is_active).length === 0 && (
                  <span className="mt-2 block text-xs text-amber-300">
                    Create an active account in Accounts before recording a
                    transaction.
                  </span>
                )}
              </label>

              <label className="text-sm text-slate-300">
                Category *
                <select
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {availableCategories.length === 0 && (
                  <span className="mt-2 block text-xs text-amber-300">
                    No active categories are available for this transaction
                    type.
                  </span>
                )}
              </label>

              <label className="text-sm text-slate-300">
                Related project (optional)
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">No project selected</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-300">
                Client or recipient (optional)
                <input
                  maxLength={150}
                  value={counterparty}
                  onChange={(event) => setCounterparty(event.target.value)}
                  placeholder="e.g. Ticket9ja"
                  className={inputClass}
                />
              </label>

              <label className="text-sm text-slate-300 sm:col-span-2">
                Payment reference (optional)
                <input
                  maxLength={150}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Transfer reference, invoice number, etc."
                  className={inputClass}
                />
              </label>

              <label className="text-sm text-slate-300 sm:col-span-2">
                Notes (optional)
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Additional details for your financial records..."
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setError('')
                }}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  accounts.filter((account) => account.is_active).length === 0 ||
                  availableCategories.length === 0
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <LoaderCircle size={17} className="animate-spin" />}
                {saving ? 'Saving transaction...' : 'Save transaction'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
