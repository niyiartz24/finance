import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Edit3,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type ProjectType =
  | 'client_project'
  | 'product'
  | 'partnership'
  | 'training'
  | 'internal'
  | 'other'

type ProjectStatus =
  | 'planning'
  | 'active'
  | 'completed'
  | 'on_hold'
  | 'cancelled'

type Project = {
  id: string
  name: string
  client_name: string | null
  type: ProjectType
  status: ProjectStatus
  description: string | null
  agreed_amount: number | null
  start_date: string | null
  due_date: string | null
  completion_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type ProjectTransaction = {
  id: string
  project_id: string | null
  type: string
  amount: number | string
  transaction_date: string
}

type ProjectForm = {
  name: string
  client_name: string
  type: ProjectType
  status: ProjectStatus
  description: string
  agreed_amount: string
  start_date: string
  due_date: string
  completion_date: string
}

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'client_project', label: 'Client project' },
  { value: 'product', label: 'Product' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'training', label: 'Training' },
  { value: 'internal', label: 'Internal' },
  { value: 'other', label: 'Other' },
]

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'cancelled', label: 'Cancelled' },
]

const EMPTY_FORM: ProjectForm = {
  name: '',
  client_name: '',
  type: 'client_project',
  status: 'planning',
  description: '',
  agreed_amount: '',
  start_date: '',
  due_date: '',
  completion_date: '',
}

const money = (value: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value || 0)

const dateLabel = (value: string | null) => {
  if (!value) return 'Not set'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)
}

const statusLabel = (status: ProjectStatus) =>
  PROJECT_STATUSES.find((item) => item.value === status)?.label ?? status

const typeLabel = (type: ProjectType) =>
  PROJECT_TYPES.find((item) => item.value === type)?.label ?? type

const statusClasses: Record<ProjectStatus, string> = {
  planning: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  active: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  completed: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  on_hold: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  cancelled: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: typeof BriefcaseBusiness
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#11131a] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="rounded-xl border border-violet-400/15 bg-violet-400/10 p-2.5 text-violet-300">
          <Icon size={19} />
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [transactions, setTransactions] = useState<ProjectTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError('')

    const [projectResult, transactionResult] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('id, project_id, type, amount, transaction_date')
        .not('project_id', 'is', null),
    ])

    if (projectResult.error) {
      setError(projectResult.error.message)
      setProjects([])
    } else {
      setProjects((projectResult.data ?? []) as Project[])
    }

    if (transactionResult.error) {
      // Projects remain usable if transaction summaries cannot be loaded.
      setTransactions([])
    } else {
      setTransactions((transactionResult.data ?? []) as ProjectTransaction[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const projectStats = useMemo(() => {
    const incomeByProject = new Map<string, number>()
    const expensesByProject = new Map<string, number>()

    transactions.forEach((transaction) => {
      if (!transaction.project_id) return
      const amount = Number(transaction.amount) || 0
      if (transaction.type === 'income') {
        incomeByProject.set(
          transaction.project_id,
          (incomeByProject.get(transaction.project_id) ?? 0) + amount,
        )
      } else if (transaction.type === 'expense') {
        expensesByProject.set(
          transaction.project_id,
          (expensesByProject.get(transaction.project_id) ?? 0) + amount,
        )
      }
    })

    return {
      incomeByProject,
      expensesByProject,
    }
  }, [transactions])

  const totals = useMemo(() => {
    const active = projects.filter((project) => project.status === 'active').length
    const agreed = projects.reduce((sum, project) => sum + Number(project.agreed_amount ?? 0), 0)
    const collected = projects.reduce(
      (sum, project) => sum + (projectStats.incomeByProject.get(project.id) ?? 0),
      0,
    )
    const projectExpenses = projects.reduce(
      (sum, project) => sum + (projectStats.expensesByProject.get(project.id) ?? 0),
      0,
    )
    return { active, agreed, collected, projectExpenses }
  }, [projects, projectStats])

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      const matchesSearch =
        !normalizedSearch ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        (project.client_name ?? '').toLowerCase().includes(normalizedSearch) ||
        (project.description ?? '').toLowerCase().includes(normalizedSearch)
      return matchesStatus && matchesSearch
    })
  }, [projects, search, statusFilter])

  const openCreate = () => {
    setEditingProject(null)
    setForm(EMPTY_FORM)
    setError('')
    setNotice('')
    setModalOpen(true)
  }

  const openEdit = (project: Project) => {
    setEditingProject(project)
    setForm({
      name: project.name ?? '',
      client_name: project.client_name ?? '',
      type: project.type ?? 'client_project',
      status: project.status ?? 'planning',
      description: project.description ?? '',
      agreed_amount:
        project.agreed_amount === null || project.agreed_amount === undefined
          ? ''
          : String(project.agreed_amount),
      start_date: project.start_date ?? '',
      due_date: project.due_date ?? '',
      completion_date: project.completion_date ?? '',
    })
    setError('')
    setNotice('')
    setModalOpen(true)
  }

  const updateForm = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const name = form.name.trim()
    if (!name) {
      setError('Project name is required.')
      setSaving(false)
      return
    }

    const amount =
      form.agreed_amount.trim() === '' ? null : Number(form.agreed_amount.replace(/,/g, ''))

    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      setError('Enter a valid non-negative agreed amount.')
      setSaving(false)
      return
    }

    const payload = {
      name,
      client_name: form.client_name.trim() || null,
      type: form.type,
      status: form.status,
      description: form.description.trim() || null,
      agreed_amount: amount,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      completion_date:
        form.status === 'completed'
          ? form.completion_date || new Date().toISOString().slice(0, 10)
          : form.completion_date || null,
    }

    let result
    if (editingProject) {
      result = await supabase.from('projects').update(payload).eq('id', editingProject.id)
    } else {
      const { data: authData } = await supabase.auth.getUser()
      result = await supabase
        .from('projects')
        .insert({ ...payload, created_by: authData.user?.id ?? null })
    }

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }

    setModalOpen(false)
    setNotice(editingProject ? 'Project updated successfully.' : 'Project created successfully.')
    setSaving(false)
    await loadProjects()
  }

  const handleDelete = async (project: Project) => {
    const confirmed = window.confirm(
      `Delete "${project.name}"? This may fail if transactions are linked to this project.`,
    )
    if (!confirmed) return

    setError('')
    setNotice('')
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', project.id)
    if (deleteError) {
      setError(
        deleteError.message.includes('foreign key') || deleteError.message.includes('violates')
          ? 'This project has linked transactions and cannot be deleted. Keep it for your records or unlink its transactions first.'
          : deleteError.message,
      )
      return
    }

    setNotice('Project deleted.')
    await loadProjects()
  }

  return (
    <div className="min-h-full space-y-7 text-slate-100">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-violet-300">
            <BriefcaseBusiness size={14} />
            Project management
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Track client work, agreed fees, delivery dates, and income or expenses linked to each project.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          <Plus size={17} />
          New project
        </button>
      </div>

      {error && !modalOpen && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <Activity size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="ml-auto text-rose-200/70 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}
      {notice && !modalOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          <Check size={16} />
          {notice}
          <button type="button" onClick={() => setNotice('')} className="ml-auto text-emerald-200/70 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active projects"
          value={String(totals.active)}
          detail={`${projects.length} project${projects.length === 1 ? '' : 's'} in total`}
          icon={BriefcaseBusiness}
        />
        <MetricCard
          label="Agreed project value"
          value={money(totals.agreed)}
          detail="Total fees recorded across projects"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Linked income"
          value={money(totals.collected)}
          detail="Income transactions assigned to projects"
          icon={ArrowDownRight}
        />
        <MetricCard
          label="Linked expenses"
          value={money(totals.projectExpenses)}
          detail="Expense transactions assigned to projects"
          icon={ArrowUpRight}
        />
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#11131a]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-semibold text-white">Project register</h2>
            <p className="mt-1 text-xs text-slate-500">Manage project details and monitor financial activity.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects or clients"
                className="w-full rounded-xl border border-white/10 bg-[#0b0d12] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50 sm:w-64"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | ProjectStatus)}
                className="w-full appearance-none rounded-xl border border-white/10 bg-[#0b0d12] py-2.5 pl-3 pr-9 text-sm text-slate-200 outline-none focus:border-violet-400/50 sm:w-40"
              >
                <option value="all">All statuses</option>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-slate-400">
            <LoaderCircle size={19} className="animate-spin text-violet-300" />
            Loading projects…
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-slate-400">
              <BriefcaseBusiness size={25} />
            </div>
            <h3 className="font-medium text-white">
              {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {projects.length === 0
                ? 'Create a project to track its agreed fee, timeline, and related financial transactions.'
                : 'Try another search term or change the status filter.'}
            </p>
            {projects.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-violet-400/30 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-400/10"
              >
                <Plus size={16} />
                Create first project
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Agreed fee</th>
                    <th className="px-4 py-3 text-right font-medium">Linked income</th>
                    <th className="px-4 py-3 font-medium">Due date</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredProjects.map((project) => {
                    const collected = projectStats.incomeByProject.get(project.id) ?? 0
                    return (
                      <tr key={project.id} className="transition hover:bg-white/[0.02]">
                        <td className="px-5 py-4">
                          <div className="font-medium text-white">{project.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {project.client_name || 'No client'} <span className="mx-1.5 text-slate-700">/</span>{' '}
                            {typeLabel(project.type)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses[project.status]}`}>
                            {statusLabel(project.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-sm tabular-nums text-slate-200">
                          {money(Number(project.agreed_amount ?? 0))}
                        </td>
                        <td className="px-4 py-4 text-right text-sm tabular-nums text-emerald-300">
                          {money(collected)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-400">{dateLabel(project.due_date)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(project)}
                              aria-label={`Edit ${project.name}`}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(project)}
                              aria-label={`Delete ${project.name}`}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {filteredProjects.map((project) => {
                const collected = projectStats.incomeByProject.get(project.id) ?? 0
                const expenses = projectStats.expensesByProject.get(project.id) ?? 0
                return (
                  <div key={project.id} className="rounded-xl border border-white/[0.07] bg-[#0d0f15] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-medium text-white">{project.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{project.client_name || 'No client'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusClasses[project.status]}`}>
                        {statusLabel(project.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-xs text-slate-500">Agreed fee</p>
                        <p className="mt-1 text-sm font-semibold text-white">{money(Number(project.agreed_amount ?? 0))}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-xs text-slate-500">Linked income</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-300">{money(collected)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} />
                        Due {dateLabel(project.due_date)}
                      </span>
                      <span>{money(expenses)} expenses</span>
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
                      <button
                        type="button"
                        onClick={() => openEdit(project)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-sm text-slate-200 hover:bg-white/[0.04]"
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(project)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/15 px-3 py-2 text-sm text-rose-300 hover:bg-rose-400/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        {!loading && filteredProjects.length > 0 && (
          <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-slate-500">
            Showing {filteredProjects.length} of {projects.length} projects
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#11131a] shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#11131a]/95 px-5 py-4 backdrop-blur sm:px-6">
              <div>
                <h2 className="font-semibold text-white">{editingProject ? 'Edit project' : 'Create project'}</h2>
                <p className="mt-1 text-xs text-slate-500">Project details and financial tracking</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close project form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-5 sm:p-6">
              {error && (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200">
                  {error}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-300">Project name <span className="text-rose-300">*</span></span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                    placeholder="e.g. Ticket9ja platform"
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-300">Client / organisation</span>
                  <input
                    value={form.client_name}
                    onChange={(event) => updateForm('client_name', event.target.value)}
                    placeholder="Client or partner name"
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-300">Project type</span>
                  <select
                    value={form.type}
                    onChange={(event) => updateForm('type', event.target.value as ProjectType)}
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none focus:border-violet-400/50"
                  >
                    {PROJECT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-300">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateForm('status', event.target.value as ProjectStatus)}
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none focus:border-violet-400/50"
                  >
                    {PROJECT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-300">Agreed fee (₦)</span>
                  <input
                    inputMode="decimal"
                    value={form.agreed_amount}
                    onChange={(event) => updateForm('agreed_amount', event.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-300">Start date</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) => updateForm('start_date', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-violet-400/50"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-300">Due date</span>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(event) => updateForm('due_date', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-violet-400/50"
                  />
                </label>
                {form.status === 'completed' && (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Completion date</span>
                    <input
                      type="date"
                      value={form.completion_date}
                      onChange={(event) => updateForm('completion_date', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-violet-400/50"
                    />
                  </label>
                )}
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-300">Description / scope</span>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => updateForm('description', event.target.value)}
                    placeholder="Short description of the work or deliverables"
                    className="w-full resize-y rounded-xl border border-white/10 bg-[#0b0d12] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
                  />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
                  {saving ? 'Saving…' : editingProject ? 'Save changes' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
