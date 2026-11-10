import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, LoaderCircle, Plus, Search, TrendingDown, TrendingUp, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type FinanceType = 'income' | 'expense'
type Account = { id: string; name: string; is_active: boolean }
type Category = { id: string; name: string; type: FinanceType; is_active: boolean }
type Project = { id: string; name: string }
type Transaction = {
  id: string
  financial_account_id: string
  category_id: string
  project_id: string | null
  type: FinanceType
  amount: number
  transaction_date: string
  description: string | null
  counterparty: string | null
  reference: string | null
  notes: string | null
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const money = (n: number) => new Intl.NumberFormat('en-NG', { style:'currency', currency:'NGN', maximumFractionDigits:2 }).format(n)
const input = 'mt-2 w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500'

export default function IncomeExpenses({ type }: { type: FinanceType }) {
  const income = type === 'income'
  const [transactions,setTransactions] = useState<Transaction[]>([])
  const [accounts,setAccounts] = useState<Account[]>([])
  const [categories,setCategories] = useState<Category[]>([])
  const [projects,setProjects] = useState<Project[]>([])
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [success,setSuccess] = useState('')
  const [search,setSearch] = useState('')
  const [month,setMonth] = useState('all')
  const [showForm,setShowForm] = useState(false)
  const [amount,setAmount] = useState('')
  const [accountId,setAccountId] = useState('')
  const [categoryId,setCategoryId] = useState('')
  const [projectId,setProjectId] = useState('')
  const [date,setDate] = useState(today())
  const [description,setDescription] = useState('')
  const [counterparty,setCounterparty] = useState('')
  const [reference,setReference] = useState('')
  const [notes,setNotes] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [tr,ac,ca,pr] = await Promise.all([
        supabase.from('transactions').select('id, financial_account_id, category_id, project_id, type, amount, transaction_date, description, counterparty, reference, notes').eq('type',type).order('transaction_date',{ascending:false}),
        supabase.from('financial_accounts').select('id,name,is_active').eq('is_active',true).order('name'),
        supabase.from('categories').select('id,name,type,is_active').eq('type',type).eq('is_active',true).order('name'),
        supabase.from('projects').select('id,name').order('name')
      ])
      if(tr.error) throw tr.error; if(ac.error) throw ac.error; if(ca.error) throw ca.error; if(pr.error) throw pr.error
      setTransactions((tr.data??[]) as Transaction[]); setAccounts((ac.data??[]) as Account[]); setCategories((ca.data??[]) as Category[]); setProjects((pr.data??[]) as Project[])
    } catch(e) { setError(e instanceof Error ? e.message : 'Unable to load financial records.') }
    finally { setLoading(false) }
  },[type])

  useEffect(()=>{ void loadData() },[loadData])
  useEffect(()=>{ if(!accountId && accounts[0]) setAccountId(accounts[0].id) },[accounts,accountId])
  useEffect(()=>{ if(!categoryId && categories[0]) setCategoryId(categories[0].id) },[categories,categoryId])

  const accountName = (id:string) => accounts.find(x=>x.id===id)?.name ?? 'Unknown account'
  const categoryName = (id:string) => categories.find(x=>x.id===id)?.name ?? 'Uncategorised'
  const projectName = (id:string|null) => projects.find(x=>x.id===id)?.name ?? 'No project'

  const filtered = useMemo(()=>{
    const q=search.trim().toLowerCase()
    return transactions.filter(t=>{
      const text=[t.description,t.counterparty,categoryName(t.category_id),accountName(t.financial_account_id)].filter(Boolean).join(' ').toLowerCase()
      return (!q || text.includes(q)) && (month==='all' || t.transaction_date.startsWith(month))
    })
  },[transactions,search,month,accounts,categories])

  const total=transactions.reduce((s,t)=>s+Number(t.amount||0),0)
  const filteredTotal=filtered.reduce((s,t)=>s+Number(t.amount||0),0)
  const months=[...new Set(transactions.map(t=>t.transaction_date.slice(0,7)))].sort((a,b)=>b.localeCompare(a))

  const reset=()=>{ setAmount(''); setProjectId(''); setDate(today()); setDescription(''); setCounterparty(''); setReference(''); setNotes(''); if(accounts[0]) setAccountId(accounts[0].id); if(categories[0]) setCategoryId(categories[0].id) }

  const save=async(e:React.FormEvent)=>{
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    const value=Number(amount)
    if(value<=0){setError('Enter an amount greater than zero.');setSaving(false);return}
    if(!accountId||!categoryId||!date){setError('Account, category and date are required.');setSaving(false);return}
    try{
      const {data:{user}}=await supabase.auth.getUser()
      if(!user) throw new Error('Your session has expired. Please sign in again.')
      const {error:e}=await supabase.from('transactions').insert({
        financial_account_id:accountId, category_id:categoryId, project_id:projectId||null,
        type, amount:value, transaction_date:date, description:description.trim()||null,
        counterparty:counterparty.trim()||null, reference:reference.trim()||null,
        notes:notes.trim()||null, source:'manual', created_by:user.id
      })
      if(e) throw e
      setSuccess(`${income?'Income':'Expense'} recorded successfully.`); setShowForm(false); reset(); await loadData()
    }catch(e){setError(e instanceof Error?e.message:'Unable to save this transaction.')}
    finally{setSaving(false)}
  }

  const remove=async(id:string)=>{
    if(!window.confirm(`Delete this ${type} transaction?`)) return
    const {error:e}=await supabase.from('transactions').delete().eq('id',id)
    if(e){setError(e.message);return}
    setSuccess('Transaction deleted.'); await loadData()
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${income?'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300':'border-rose-500/20 bg-rose-500/[0.06] text-rose-300'}`}>
          {income?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {income?'Revenue records':'Expense records'}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{income?'Income':'Expenses'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{income?'Track money earned by SynthaxLab across projects, services, products and other revenue sources.':'Track operating costs, subscriptions, infrastructure, personnel and other business expenses.'}</p>
      </div>
      <button onClick={()=>{reset();setShowForm(true)}} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white ${income?'bg-emerald-600 hover:bg-emerald-500':'bg-rose-600 hover:bg-rose-500'}`}><Plus size={17}/> Add {income?'income':'expense'}</button>
    </div>

    {error&&<div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-300">{error}</div>}
    {success&&<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm text-emerald-300">{success}</div>}

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-400">Total {income?'income':'expenses'}</p><div className={income?'rounded-xl bg-emerald-500/10 p-3 text-emerald-300':'rounded-xl bg-rose-500/10 p-3 text-rose-300'}>{income?<ArrowDownLeft size={19}/>:<ArrowUpRight size={19}/>}</div></div><p className="mt-4 text-2xl font-semibold text-white">{money(total)}</p><p className="mt-2 text-xs text-slate-500">{transactions.length} recorded transaction{transactions.length===1?'':'s'}</p></article>
      <article className="rounded-2xl border border-white/[0.07] bg-[#12151f] p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-400">Filtered total</p><CalendarDays size={19} className="text-violet-300"/></div><p className="mt-4 text-2xl font-semibold text-white">{money(filteredTotal)}</p><p className="mt-2 text-xs text-slate-500">{filtered.length} matching record{filtered.length===1?'':'s'}</p></article>
    </div>

    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#12151f]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row">
        <div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${income?'income':'expenses'}...`} className="w-full rounded-xl border border-white/10 bg-[#0b0d14] py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500"/></div>
        <select value={month} onChange={e=>setMonth(e.target.value)} className="rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-3 text-sm text-slate-300 outline-none focus:border-violet-500"><option value="all">All months</option>{months.map(m=><option key={m} value={m}>{new Date(`${m}-01T00:00:00`).toLocaleDateString('en-NG',{month:'long',year:'numeric'})}</option>)}</select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left"><thead className="bg-white/[0.015]"><tr className="text-[11px] uppercase tracking-wider text-slate-500"><th className="px-6 py-4 font-medium">Description</th><th className="px-6 py-4 font-medium">Category</th><th className="px-6 py-4 font-medium">Account</th><th className="px-6 py-4 font-medium">Project</th><th className="px-6 py-4 font-medium">Date</th><th className="px-6 py-4 text-right font-medium">Amount</th><th className="px-6 py-4 text-right font-medium">Action</th></tr></thead>
          <tbody className="divide-y divide-white/[0.04]">{loading?<tr><td colSpan={7} className="px-6 py-14 text-center"><LoaderCircle size={20} className="mx-auto animate-spin text-violet-300"/><p className="mt-3 text-sm text-slate-500">Loading financial records…</p></td></tr>:filtered.length===0?<tr><td colSpan={7} className="px-6 py-14 text-center"><p className="text-sm font-medium text-slate-300">No {income?'income':'expense'} records found</p><p className="mt-1 text-xs text-slate-500">Add your first record to start tracking this section.</p></td></tr>:filtered.map(t=><tr key={t.id} className="text-sm">
            <td className="px-6 py-4"><p className="font-medium text-slate-200">{t.description||'Financial transaction'}</p>{t.counterparty&&<p className="mt-1 text-xs text-slate-500">{t.counterparty}</p>}</td>
            <td className="px-6 py-4 text-slate-400">{categoryName(t.category_id)}</td><td className="px-6 py-4 text-slate-400">{accountName(t.financial_account_id)}</td><td className="px-6 py-4 text-slate-400">{projectName(t.project_id)}</td>
            <td className="px-6 py-4 text-slate-400">{new Date(`${t.transaction_date}T00:00:00`).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</td>
            <td className={`px-6 py-4 text-right font-medium tabular-nums ${income?'text-emerald-300':'text-rose-300'}`}>{income?'+':'−'}{money(Number(t.amount||0))}</td>
            <td className="px-6 py-4 text-right"><button onClick={()=>remove(t.id)} className="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-rose-500/10 hover:text-rose-300">Delete</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    {showForm&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#141722] p-6 shadow-2xl">
      <div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Add {income?'income':'expense'}</h2><p className="mt-1 text-xs text-slate-400">Record it directly in Supabase.</p></div><button type="button" onClick={()=>setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><X size={18}/></button></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-300">Amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className={input}/></label>
        <label className="text-sm text-slate-300">Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)} className={input}/></label>
        <label className="text-sm text-slate-300">Financial account<select required value={accountId} onChange={e=>setAccountId(e.target.value)} className={input}><option value="">Select account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="text-sm text-slate-300">Category<select required value={categoryId} onChange={e=>setCategoryId(e.target.value)} className={input}><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-sm text-slate-300 sm:col-span-2">Project<select value={projectId} onChange={e=>setProjectId(e.target.value)} className={input}><option value="">No project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="text-sm text-slate-300 sm:col-span-2">Description<input value={description} onChange={e=>setDescription(e.target.value)} placeholder={income?'e.g. Ticket9ja website payment':'e.g. Monthly hosting bill'} className={input}/></label>
        <label className="text-sm text-slate-300">Counterparty<input value={counterparty} onChange={e=>setCounterparty(e.target.value)} placeholder={income?'Client / customer':'Vendor / provider'} className={input}/></label>
        <label className="text-sm text-slate-300">Reference<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Invoice / receipt / transfer ref" className={input}/></label>
        <label className="text-sm text-slate-300 sm:col-span-2">Notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional internal notes" className={input}/></label>
      </div>
      {error&&<div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-xs text-rose-300">{error}</div>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={()=>setShowForm(false)} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300 hover:bg-white/5">Cancel</button><button disabled={saving} type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60">{saving&&<LoaderCircle size={16} className="animate-spin"/>}Save {income?'income':'expense'}</button></div>
    </form></div>}
  </div>
}
