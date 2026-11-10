import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type TransactionType = 'income' | 'expense'

type Category = {
  id: string
  name: string
  type: TransactionType
  is_active: boolean
}

type Budget = {
  id: string
  category_id: string
  budget_year: number
  budget_month: number
  amount: number
  notes: string | null
}

type ExpenseTransaction = {
  id: string
  category_id: string
  amount: number
  transaction_date: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const currentDate = new Date()
const currentMonth = currentDate.getMonth() + 1
const currentYear = currentDate.getFullYear()

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)

const inputClass =
  'mt-2 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500'

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([])
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0)
      const endDateString = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

      const [budgetResult, categoryResult, expenseResult] = await Promise.all([
        supabase
          .from('budgets')
          .select('id, category_id, budget_year, budget_month, amount, notes')
          .eq('budget_year', year)
          .eq('budget_month', month)
          .order('created_at', { ascending: false }),

        supabase
          .from('categories')
          .select('id, name, type, is_active')
          .eq('type', 'expense')
          .order('name'),

        supabase
          .from('transactions')
          .select('id, category_id, amount, transaction_date')
          .eq('type', 'expense')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDateString),
      ])

      if (budgetResult.error) throw budgetResult.error
      if (categoryResult.error) throw categoryResult.error
      if (expenseResult.error) throw expenseResult.error

      setBudgets((budgetResult.data ?? []) as Budget[])
      setCategories((categoryResult.data ?? []) as Category[])
      setExpenses((expenseResult.data ?? []) as ExpenseTransaction[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load budgets.')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const budgetRows = useMemo(() => {
    return budgets
      .map((budget) => {
        const category = categoryById.get(budget.category_id)
        const actual = expenses
          .filter((transaction) => transaction.category_id === budget.category_id)
          .reduce((total, transaction) => total + Number(transaction.amount), 0)
        const planned = Number(budget.amount)
        const percentage = planned > 0 ? (actual / planned) * 100 : actual > 0 ? 100 : 0

        return {
          ...budget,
          categoryName: category?.name ?? 'Category unavailable',
          actual,
          remaining: planned - actual,
          percentage,
        }
      })
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [budgets, categoryById, expenses])

  const totalBudget = budgetRows.reduce((total, row) => total + Number(row.amount), 0)
  const totalSpent = budgetRows.reduce((total, row) => total + row.actual, 0)
  const totalRemaining = totalBudget - totalSpent
  const overBudgetCount = budgetRows.filter((row) => row.actual > Number(row.amount)).length

  const resetForm = () => {
    setEditingBudget(null)
    setCategoryId('')
    setAmount('')
    setNotes('')
    setError('')
  }

  const openCreateForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditForm = (budget: Budget) => {
    setError('')
    setEditingBudget(budget)
    setCategoryId(budget.category_id)
    setAmount(String(budget.amount))
    setNotes(budget.notes ?? '')
    setShowForm(true)
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const numericAmount = Number(amount)
    if (!categoryId) {
      setError('Choose an expense category.')
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a budget amount greater than zero.')
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

      const payload = {
        category_id: categoryId,
        budget_year: year,
        budget_month: month,
        amount: numericAmount,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editingBudget) {
        const { error: updateError } = await supabase
          .from('budgets')
          .update(payload)
          .eq('id', editingBudget.id)

        if (updateError) throw updateError
        setSuccess('Budget updated successfully.')
      } else {
        const { data: existing, error: existingError } = await supabase
          .from('budgets')
          .select('id')
          .eq('category_id', categoryId)
          .eq('budget_year', year)
          .eq('budget_month', month)
          .maybeSingle()

        if (existingError) throw existingError

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from('budgets')
            .update(payload)
            .eq('id', existing.id)

          if (updateError) throw updateError
          setSuccess('An existing budget for this category was updated.')
        } else {
          const { error: insertError } = await supabase
            .from('budgets')
            .insert({ ...payload, created_by: user.id })

          if (insertError) throw insertError
          setSuccess('Budget created successfully.')
        }
      }

      setShowForm(false)
      resetForm()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this budget.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (budget: Budget) => {
    const confirmed = window.confirm(
      `Delete the ${budget.category_id === '' ? '' : (categoryById.get(budget.category_id)?.name ?? 'category') + ' '}budget for ${MONTHS[month - 1]} ${year}?`,
    )
    if (!confirmed) return

    setError('')
    setSuccess('')

    const { error: deleteError } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budget.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setSuccess('Budget deleted.')
    await loadData()
  }

  const changePeriod = (nextYear: number, nextMonth: number) => {
    setYear(nextYear)
    setMonth(nextMonth)
    setSuccess('')
    setError('')
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-violet-300">
            Planning & control
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Budgets
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Set monthly spending limits and compare planned costs with actual expenses.
          </p>
        </div>

        <button
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          <Plus size={17} />
          Set a budget
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#12151f] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <CalendarDays size={17} className="text-violet-300" />
          <span className="font-medium">Budget period</span>
        </div>
        <div className="flex gap-3">
          <select
            aria-label="Budget month"
            value={month}
            onChange={(event) => changePeriod(year, Number(event.target.value))}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-3 text-sm text-white outline-none focus:border-violet-500 sm:flex-none"
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>{name}</option>
            ))}
          </select>
          <select
            aria-label="Budget year"
            value={year}
            onChange={(event) => changePeriod(Number(event.target.value), month)}
            className="rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-3 text-sm text-white outline-none focus:border-violet-500"
          >
            {Array.from({ length: 7 }, (_, index) => currentYear - 3 + index).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Total budget</p>
            <Target size={19} className="text-violet-300" />
          </div>
          <p className="mt-4 text-xl font-semibold text-white">{formatMoney(totalBudget)}</p>
          <p className="mt-2 text-xs text-slate-500">{budgetRows.length} budgeted categories</p>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Actual spending</p>
            <CircleDollarSign size={19} className="text-amber-300" />
          </div>
          <p className="mt-4 text-xl font-semibold text-white">{formatMoney(totalSpent)}</p>
          <p className="mt-2 text-xs text-slate-500">Against this month's budgets</p>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Budget remaining</p>
            <CircleDollarSign size={19} className={totalRemaining < 0 ? 'text-rose-300' : 'text-emerald-300'} />
          </div>
          <p className={`mt-4 text-xl font-semibold ${totalRemaining < 0 ? 'text-rose-300' : 'text-white'}`}>
            {formatMoney(totalRemaining)}
          </p>
          <p className="mt-2 text-xs text-slate-500">Budget minus spending</p>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Over budget</p>
            <AlertTriangle size={19} className={overBudgetCount > 0 ? 'text-rose-300' : 'text-slate-500'} />
          </div>
          <p className={`mt-4 text-xl font-semibold ${overBudgetCount > 0 ? 'text-rose-300' : 'text-white'}`}>
            {overBudgetCount}
          </p>
          <p className="mt-2 text-xs text-slate-500">Categories over their limit</p>
        </article>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#12151f]">
        <div className="border-b border-white/[0.07] p-4 sm:p-5">
          <h2 className="font-semibold text-white">Category budgets</h2>
          <p className="mt-1 text-xs text-slate-500">
            {MONTHS[month - 1]} {year} · actuals are calculated from expense transactions
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-slate-400">
            <LoaderCircle size={19} className="animate-spin" />
            Loading budgets...
          </div>
        ) : budgetRows.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/[0.08] text-violet-300">
              <Target size={25} />
            </div>
            <h3 className="font-medium text-slate-200">No budgets for this period</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Set a spending limit for an expense category to start tracking your budget.
            </p>
            <button
              onClick={openCreateForm}
              className="mt-5 rounded-xl border border-violet-500/20 px-4 py-2.5 text-sm text-violet-300 hover:bg-violet-500/10"
            >
              Create your first budget
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {budgetRows.map((row) => {
              const isOver = row.actual > Number(row.amount)
              const isNear = row.percentage >= 80 && !isOver
              const progress = Math.min(row.percentage, 100)

              return (
                <article key={row.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-white">{row.categoryName}</h3>
                        {isOver && (
                          <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">
                            Over budget
                          </span>
                        )}
                        {isNear && (
                          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                            Near limit
                          </span>
                        )}
                      </div>
                      {row.notes && <p className="mt-1 text-sm text-slate-500">{row.notes}</p>}
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className={`h-full rounded-full transition-all ${isOver ? 'bg-rose-400' : isNear ? 'bg-amber-300' : 'bg-violet-400'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                        <span>{row.percentage.toFixed(1)}% used</span>
                        <span>{formatMoney(row.actual)} spent of {formatMoney(Number(row.amount))}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:min-w-48 sm:justify-end">
                      <div className="sm:text-right">
                        <p className="text-xs text-slate-500">Remaining</p>
                        <p className={`mt-1 font-semibold ${row.remaining < 0 ? 'text-rose-300' : 'text-white'}`}>
                          {formatMoney(row.remaining)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditForm(row)}
                          className="rounded-lg p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
                          aria-label={`Edit ${row.categoryName} budget`}
                          title="Edit budget"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => void handleDelete(row)}
                          className="rounded-lg p-2.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                          aria-label={`Delete ${row.categoryName} budget`}
                          title="Delete budget"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#141722] p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {editingBudget ? 'Edit budget' : 'Set a budget'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {MONTHS[month - 1]} {year}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <label className="block text-sm text-slate-300">
                Expense category *
                <select
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((category) => category.is_active || category.id === editingBudget?.category_id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Monthly spending limit (NGN) *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="e.g. 25000"
                  className={inputClass}
                />
              </label>

              <label className="block text-sm text-slate-300">
                Notes (optional)
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="What is this budget intended to cover?"
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || categories.filter((category) => category.is_active).length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <LoaderCircle size={17} className="animate-spin" />}
                {saving ? 'Saving budget...' : editingBudget ? 'Save changes' : 'Save budget'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
