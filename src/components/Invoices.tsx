import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'payment_gateway' | 'other'

type Invoice = {
  id: string
  invoice_number: string
  project_id: string | null
  client_name: string
  client_email: string | null
  description: string | null
  issue_date: string
  due_date: string | null
  amount: number | string
  status: InvoiceStatus
  notes: string | null
  created_at: string
}

type Payment = {
  id: string
  invoice_id: string
  amount: number | string
  payment_date: string
  method: PaymentMethod
  reference: string | null
  notes: string | null
}

type Project = { id: string; name: string; client_name: string | null }

const STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'payment_gateway', label: 'Payment gateway' },
  { value: 'other', label: 'Other' },
]
const money = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n || 0)
const dateText = (value: string | null) => {
  if (!value) return 'Not set'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
const labelStatus = (status: InvoiceStatus) => STATUSES.find((s) => s.value === status)?.label ?? status
const statusStyle: Record<InvoiceStatus, string> = {
  draft: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  sent: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  partially_paid: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  paid: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  overdue: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  cancelled: 'border-slate-500/20 bg-slate-500/10 text-slate-500',
}

const emptyInvoice = {
  invoice_number: '',
  project_id: '',
  client_name: '',
  client_email: '',
  description: '',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  amount: '',
  status: 'draft' as InvoiceStatus,
  notes: '',
}
const emptyPayment = {
  amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  method: 'bank_transfer' as PaymentMethod,
  reference: '',
  notes: '',
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all')
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [invoiceResult, paymentResult, projectResult] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('invoice_payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('projects').select('id, name, client_name').order('name'),
    ])
    if (invoiceResult.error) {
      setError(invoiceResult.error.message)
      setInvoices([])
    } else setInvoices((invoiceResult.data ?? []) as Invoice[])
    if (paymentResult.error) {
      setPayments([])
      if (!invoiceResult.error) setError(paymentResult.error.message)
    } else setPayments((paymentResult.data ?? []) as Payment[])
    if (!projectResult.error) setProjects((projectResult.data ?? []) as Project[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const paidByInvoice = useMemo(() => {
    const totals = new Map<string, number>()
    payments.forEach((payment) => totals.set(payment.invoice_id, (totals.get(payment.invoice_id) ?? 0) + Number(payment.amount)))
    return totals
  }, [payments])

  const getPaid = (invoice: Invoice) => paidByInvoice.get(invoice.id) ?? 0
  const getBalance = (invoice: Invoice) => Math.max(0, Number(invoice.amount) - getPaid(invoice))
  const effectiveStatus = (invoice: Invoice): InvoiceStatus => {
    if (invoice.status === 'cancelled' || invoice.status === 'draft') return invoice.status
    if (getBalance(invoice) <= 0) return 'paid'
    if (getPaid(invoice) > 0) return 'partially_paid'
    if (invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10)) return 'overdue'
    return invoice.status === 'overdue' ? 'overdue' : 'sent'
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const status = effectiveStatus(invoice)
      const matchesStatus = filter === 'all' || status === filter
      const matchesTerm = !term || invoice.invoice_number.toLowerCase().includes(term) ||
        invoice.client_name.toLowerCase().includes(term) ||
        (invoice.client_email ?? '').toLowerCase().includes(term) ||
        (invoice.description ?? '').toLowerCase().includes(term)
      return matchesStatus && matchesTerm
    })
  }, [invoices, search, filter, paidByInvoice])

  const stats = useMemo(() => {
    const outstanding = invoices.filter((i) => !['draft', 'cancelled'].includes(i.status)).reduce((s, i) => s + getBalance(i), 0)
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0)
    const issued = invoices.filter((i) => !['draft', 'cancelled'].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0)
    const overdue = invoices.filter((i) => effectiveStatus(i) === 'overdue').reduce((s, i) => s + getBalance(i), 0)
    return { outstanding, paid, issued, overdue }
  }, [invoices, payments, paidByInvoice])

  const openNew = () => {
    setInvoiceForm({ ...emptyInvoice, invoice_number: `SL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}` })
    setError('')
    setNotice('')
    setInvoiceModal(true)
  }

  const saveInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const amount = Number(invoiceForm.amount)
    if (!invoiceForm.invoice_number.trim() || !invoiceForm.client_name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter an invoice number, client name, and a valid amount greater than zero.')
      setSaving(false)
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    const payload = {
      invoice_number: invoiceForm.invoice_number.trim(),
      project_id: invoiceForm.project_id || null,
      client_name: invoiceForm.client_name.trim(),
      client_email: invoiceForm.client_email.trim() || null,
      description: invoiceForm.description.trim() || null,
      issue_date: invoiceForm.issue_date,
      due_date: invoiceForm.due_date || null,
      amount,
      status: invoiceForm.status,
      notes: invoiceForm.notes.trim() || null,
      created_by: authData.user?.id ?? null,
    }
    const { error: insertError } = await supabase.from('invoices').insert(payload)
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    setInvoiceModal(false)
    setSaving(false)
    setNotice('Invoice created successfully.')
    await load()
  }

  const addPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!paymentInvoice) return
    setSaving(true)
    setError('')
    const amount = Number(paymentForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Payment amount must be greater than zero.')
      setSaving(false)
      return
    }
    if (amount > getBalance(paymentInvoice)) {
      setError(`Payment exceeds the outstanding balance of ${money(getBalance(paymentInvoice))}.`)
      setSaving(false)
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('invoice_payments').insert({
      invoice_id: paymentInvoice.id,
      amount,
      payment_date: paymentForm.payment_date,
      method: paymentForm.method,
      reference: paymentForm.reference.trim() || null,
      notes: paymentForm.notes.trim() || null,
      created_by: authData.user?.id ?? null,
    })
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    const newPaid = getPaid(paymentInvoice) + amount
    const nextStatus: InvoiceStatus = newPaid >= Number(paymentInvoice.amount) ? 'paid' : 'partially_paid'
    await supabase.from('invoices').update({ status: nextStatus }).eq('id', paymentInvoice.id)
    setPaymentInvoice(null)
    setPaymentForm(emptyPayment)
    setSaving(false)
    setNotice('Payment recorded.')
    await load()
  }

  const deleteInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`Delete invoice ${invoice.invoice_number} and its payment records?`)) return
    setError('')
    const { error: deleteError } = await supabase.from('invoices').delete().eq('id', invoice.id)
    if (deleteError) setError(deleteError.message)
    else {
      setNotice(`Invoice ${invoice.invoice_number} deleted.`)
      await load()
    }
  }

  const setInvoiceField = (key: keyof typeof emptyInvoice, value: string) => setInvoiceForm((current) => ({ ...current, [key]: value }))
  const setPaymentField = (key: keyof typeof emptyPayment, value: string) => setPaymentForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="space-y-7 text-slate-100">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-violet-300"><FileText size={14} /> Billing and receivables</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Invoices</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Issue client invoices, record partial or full payments, and keep outstanding balances visible.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-400"><Plus size={17} /> New invoice</button>
      </div>

      {error && <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"><X size={16} className="mt-0.5 shrink-0" /><span>{error}</span><button onClick={() => setError('')} className="ml-auto"><X size={15} /></button></div>}
      {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"><Check size={16} />{notice}<button onClick={() => setNotice('')} className="ml-auto"><X size={15} /></button></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total issued', value: money(stats.issued), detail: 'Invoices sent or awaiting payment', icon: FileText },
          { label: 'Payments received', value: money(stats.paid), detail: 'All recorded invoice payments', icon: BadgeDollarSign },
          { label: 'Outstanding', value: money(stats.outstanding), detail: 'Balance still due from clients', icon: CircleDollarSign },
          { label: 'Overdue balance', value: money(stats.overdue), detail: 'Past-due invoices with a balance', icon: CalendarClock },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#11131a] p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className="rounded-xl border border-violet-400/15 bg-violet-400/10 p-2.5 text-violet-300"><Icon size={19} /></div></div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#11131a]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 className="font-semibold text-white">Invoice register</h2><p className="mt-1 text-xs text-slate-500">Invoice balances update from payment records.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices or clients" className="w-full rounded-xl border border-white/10 bg-[#0b0d12] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50 sm:w-64" /></div>
            <div className="relative"><select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | InvoiceStatus)} className="w-full appearance-none rounded-xl border border-white/10 bg-[#0b0d12] py-2.5 pl-3 pr-9 text-sm text-slate-200 outline-none focus:border-violet-400/50 sm:w-44"><option value="all">All statuses</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /></div>
          </div>
        </div>
        {loading ? <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin text-violet-300" />Loading invoices…</div> : filtered.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center px-5 text-center"><div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-slate-400"><FileText size={25} /></div><h3 className="font-medium text-white">{invoices.length ? 'No matching invoices' : 'No invoices yet'}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{invoices.length ? 'Change the search or status filter.' : 'Create your first invoice to start tracking client receivables.'}</p>{!invoices.length && <button onClick={openNew} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-violet-400/30 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-400/10"><Plus size={16} /> Create first invoice</button>}</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[920px] text-left"><thead><tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500"><th className="px-5 py-3 font-medium">Invoice / Client</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Amount</th><th className="px-4 py-3 text-right font-medium">Paid</th><th className="px-4 py-3 text-right font-medium">Balance</th><th className="px-4 py-3 font-medium">Due date</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{filtered.map((invoice) => { const paid = getPaid(invoice); const balance = getBalance(invoice); const status = effectiveStatus(invoice); return <tr key={invoice.id} className="hover:bg-white/[0.02]"><td className="px-5 py-4"><div className="font-medium text-white">{invoice.invoice_number}</div><div className="mt-1 text-xs text-slate-500">{invoice.client_name}</div>{invoice.description && <div className="mt-1 max-w-52 truncate text-xs text-slate-600">{invoice.description}</div>}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle[status]}`}>{labelStatus(status)}</span></td><td className="px-4 py-4 text-right text-sm tabular-nums text-slate-200">{money(Number(invoice.amount))}</td><td className="px-4 py-4 text-right text-sm tabular-nums text-emerald-300">{money(paid)}</td><td className="px-4 py-4 text-right text-sm tabular-nums text-white">{money(balance)}</td><td className="px-4 py-4 text-sm text-slate-400">{dateText(invoice.due_date)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => { setPaymentInvoice(invoice); setPaymentForm(emptyPayment); setError('') }} disabled={balance <= 0 || status === 'cancelled' || status === 'draft'} className="rounded-lg border border-violet-400/20 px-2.5 py-2 text-xs font-medium text-violet-200 hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-30">Record payment</button><button onClick={() => void deleteInvoice(invoice)} aria-label={`Delete ${invoice.invoice_number}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 size={15} /></button></div></td></tr> })}</tbody></table></div>
            <div className="space-y-3 p-3 md:hidden">{filtered.map((invoice) => { const paid = getPaid(invoice); const balance = getBalance(invoice); const status = effectiveStatus(invoice); return <div key={invoice.id} className="rounded-xl border border-white/[0.07] bg-[#0d0f15] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium text-white">{invoice.invoice_number}</h3><p className="mt-1 text-sm text-slate-500">{invoice.client_name}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusStyle[status]}`}>{labelStatus(status)}</span></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-white/[0.03] p-3"><p className="text-xs text-slate-500">Invoice amount</p><p className="mt-1 text-sm font-semibold text-white">{money(Number(invoice.amount))}</p></div><div className="rounded-lg bg-white/[0.03] p-3"><p className="text-xs text-slate-500">Outstanding</p><p className="mt-1 text-sm font-semibold text-amber-300">{money(balance)}</p></div></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock3 size={13} />Due {dateText(invoice.due_date)}</span><span>Paid {money(paid)}</span></div><div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3"><button onClick={() => { setPaymentInvoice(invoice); setPaymentForm(emptyPayment); setError('') }} disabled={balance <= 0 || status === 'cancelled' || status === 'draft'} className="flex-1 rounded-lg border border-violet-400/20 py-2 text-sm text-violet-200 hover:bg-violet-400/10 disabled:opacity-30">Record payment</button><button onClick={() => void deleteInvoice(invoice)} aria-label={`Delete ${invoice.invoice_number}`} className="rounded-lg border border-rose-400/15 px-3 py-2 text-rose-300 hover:bg-rose-400/10"><Trash2 size={15} /></button></div></div> })}</div>
          </>
        )}
        {!loading && filtered.length > 0 && <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-slate-500">Showing {filtered.length} of {invoices.length} invoices</div>}
      </div>

      {invoiceModal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#11131a] shadow-2xl sm:rounded-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#11131a]/95 px-5 py-4"><div><h2 className="font-semibold text-white">Create invoice</h2><p className="mt-1 text-xs text-slate-500">Record the amount owed by a client</p></div><button onClick={() => setInvoiceModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06]"><X size={18} /></button></div><form onSubmit={saveInvoice} className="space-y-4 p-5 sm:p-6">{error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}<div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2"><span className="text-sm text-slate-300">Invoice number *</span><input required value={invoiceForm.invoice_number} onChange={(e) => setInvoiceField('invoice_number', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label>
        <label className="space-y-2"><span className="text-sm text-slate-300">Amount (₦) *</span><input required min="0.01" step="0.01" type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceField('amount', e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label>
        <label className="space-y-2"><span className="text-sm text-slate-300">Client / organisation *</span><input required value={invoiceForm.client_name} onChange={(e) => setInvoiceField('client_name', e.target.value)} placeholder="Client name" className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label>
        <label className="space-y-2"><span className="text-sm text-slate-300">Client email</span><input type="email" value={invoiceForm.client_email} onChange={(e) => setInvoiceField('client_email', e.target.value)} placeholder="client@example.com" className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label>
        <label className="space-y-2"><span className="text-sm text-slate-300">Link to project</span><select value={invoiceForm.project_id} onChange={(e) => { const project = projects.find((p) => p.id === e.target.value); setInvoiceForm((current) => ({ ...current, project_id: e.target.value, client_name: current.client_name || project?.client_name || '' })) }} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50"><option value="">No linked project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="space-y-2"><span className="text-sm text-slate-300">Initial status</span><select value={invoiceForm.status} onChange={(e) => setInvoiceField('status', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50"><option value="draft">Draft</option><option value="sent">Sent</option></select></label>
        <label className="space-y-2"><span className="text-sm text-slate-300">Issue date *</span><input required type="date" value={invoiceForm.issue_date} onChange={(e) => setInvoiceField('issue_date', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none [color-scheme:dark]" /></label>
        <label className="space-y-2"><span className="text-sm text-slate-300">Due date</span><input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceField('due_date', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none [color-scheme:dark]" /></label>
        <label className="space-y-2 sm:col-span-2"><span className="text-sm text-slate-300">Description</span><input value={invoiceForm.description} onChange={(e) => setInvoiceField('description', e.target.value)} placeholder="Work or deliverables covered by this invoice" className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label>
        <label className="space-y-2 sm:col-span-2"><span className="text-sm text-slate-300">Notes</span><textarea rows={2} value={invoiceForm.notes} onChange={(e) => setInvoiceField('notes', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label>
      </div><div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setInvoiceModal(false)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancel</button><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}Create invoice</button></div></form></div></div>}

      {paymentInvoice && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-[#11131a] shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><h2 className="font-semibold text-white">Record payment</h2><p className="mt-1 text-xs text-slate-500">{paymentInvoice.invoice_number} · {paymentInvoice.client_name}</p></div><button onClick={() => setPaymentInvoice(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06]"><X size={18} /></button></div><form onSubmit={addPayment} className="space-y-4 p-5">{error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}<div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"><p className="text-xs text-slate-500">Outstanding balance</p><p className="mt-1 text-xl font-semibold text-white">{money(getBalance(paymentInvoice))}</p></div><label className="block space-y-2"><span className="text-sm text-slate-300">Payment amount (₦) *</span><input required type="number" min="0.01" max={getBalance(paymentInvoice)} step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentField('amount', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2"><span className="text-sm text-slate-300">Payment date</span><input required type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentField('payment_date', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none [color-scheme:dark]" /></label><label className="space-y-2"><span className="text-sm text-slate-300">Method</span><select value={paymentForm.method} onChange={(e) => setPaymentField('method', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none">{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label></div><label className="block space-y-2"><span className="text-sm text-slate-300">Reference</span><input value={paymentForm.reference} onChange={(e) => setPaymentField('reference', e.target.value)} placeholder="Transfer or gateway reference" className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label><label className="block space-y-2"><span className="text-sm text-slate-300">Notes</span><textarea rows={2} value={paymentForm.notes} onChange={(e) => setPaymentField('notes', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50" /></label><div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setPaymentInvoice(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancel</button><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}Save payment</button></div></form></div></div>}
    </div>
  )
}
