'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  User,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Monitor,
  Laptop,
  Cpu,
  HardDrive,
  MemoryStick,
  Check,
  Search,
  Save,
  ArrowRight,
} from 'lucide-react'
import type { SavedProfile, CPU, GPU } from '@/types'

interface ProfileFormData {
  name: string
  type: 'desktop' | 'laptop'
  cpuId: string
  cpuName: string
  gpuId: string
  gpuName: string
  ramGB: number
  ramSpeed: number
  storageType: string
  storageCapacity: number
  displayResolution: string
}

const defaultForm: ProfileFormData = {
  name: '',
  type: 'desktop',
  cpuId: '',
  cpuName: '',
  gpuId: '',
  gpuName: '',
  ramGB: 16,
  ramSpeed: 3200,
  storageType: 'NVMe',
  storageCapacity: 512,
  displayResolution: '1920x1080',
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileFormData>({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [cpuQuery, setCpuQuery] = useState('')
  const [cpus, setCpus] = useState<CPU[]>([])
  const [cpuDropdown, setCpuDropdown] = useState(false)
  const cpuRef = useRef<HTMLDivElement>(null)

  const [gpuQuery, setGpuQuery] = useState('')
  const [gpus, setGpus] = useState<GPU[]>([])
  const [gpuDropdown, setGpuDropdown] = useState(false)
  const gpuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((data) => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load profiles'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cpuRef.current && !cpuRef.current.contains(e.target as Node)) setCpuDropdown(false)
      if (gpuRef.current && !gpuRef.current.contains(e.target as Node)) setGpuDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!cpuQuery.trim()) return
    const t = setTimeout(() => {
      fetch(`/api/hardware/cpus?q=${encodeURIComponent(cpuQuery)}`)
        .then((r) => r.json())
        .then((d) => { setCpus(Array.isArray(d) ? d.slice(0, 10) : []); setCpuDropdown(true) })
        .catch(() => setCpus([]))
    }, 300)
    return () => clearTimeout(t)
  }, [cpuQuery])

  useEffect(() => {
    if (!gpuQuery.trim()) return
    const t = setTimeout(() => {
      fetch(`/api/hardware/gpus?q=${encodeURIComponent(gpuQuery)}`)
        .then((r) => r.json())
        .then((d) => { setGpus(Array.isArray(d) ? d.slice(0, 10) : []); setGpuDropdown(true) })
        .catch(() => setGpus([]))
    }, 300)
    return () => clearTimeout(t)
  }, [gpuQuery])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setCpuQuery('')
    setGpuQuery('')
    setCpus([])
    setCpuDropdown(false)
    setGpus([])
    setGpuDropdown(false)
    setShowForm(true)
    setError('')
  }

  const openEdit = (profile: SavedProfile) => {
    setEditingId(profile.id)
    setForm({
      name: profile.name,
      type: profile.type,
      cpuId: profile.cpuId,
      cpuName: profile.cpuId,
      gpuId: profile.gpuId,
      gpuName: profile.gpuId,
      ramGB: profile.ramGB,
      ramSpeed: profile.ramSpeed,
      storageType: profile.storageType,
      storageCapacity: profile.storageCapacity,
      displayResolution: profile.displayResolution,
    })
    setCpuQuery('')
    setGpuQuery('')
    setCpus([])
    setCpuDropdown(false)
    setGpus([])
    setGpuDropdown(false)
    setShowForm(true)
    setError('')
  }

  const handleCpuQueryChange = useCallback((value: string) => {
    setCpuQuery(value)
    if (!value.trim()) {
      setCpus([])
      setCpuDropdown(false)
    }
  }, [])

  const handleGpuQueryChange = useCallback((value: string) => {
    setGpuQuery(value)
    if (!value.trim()) {
      setGpus([])
      setGpuDropdown(false)
    }
  }, [])

  const refetchProfiles = useCallback(() => {
    setLoading(true)
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((data) => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load profiles'))
      .finally(() => setLoading(false))
  }, [])

  const saveProfile = async () => {
    if (!form.name.trim() || !form.cpuId || !form.gpuId) {
      setError('Name, CPU, and GPU are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        cpuId: form.cpuId,
        gpuId: form.gpuId,
        ramGB: form.ramGB,
        ramSpeed: form.ramSpeed,
        storageType: form.storageType,
        storageCapacity: form.storageCapacity,
        displayResolution: form.displayResolution,
      }
      const url = editingId ? `/api/profiles/${editingId}` : '/api/profiles'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to save profile')
      }
      setShowForm(false)
      setEditingId(null)
      refetchProfiles()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const deleteProfile = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setDeleteConfirm(null)
      refetchProfiles()
    } catch {
      setError('Failed to delete profile')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  const ramOptions = [4, 8, 16, 32, 64, 96, 128]
  const storageOptions = [
    { label: '128 GB', value: 128 },
    { label: '256 GB', value: 256 },
    { label: '512 GB', value: 512 },
    { label: '1 TB', value: 1024 },
    { label: '2 TB', value: 2048 },
    { label: '4 TB', value: 4096 },
  ]
  const storageTypes = ['NVMe', 'SSD', 'HDD']
  const resolutions = ['1920x1080', '2560x1440', '3840x2160', '1366x768', '3440x1440']

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="h-8 w-8 text-accent" />
          <div>
            <h1 className="text-3xl font-bold">Saved Profiles</h1>
            <p className="text-text-secondary">Manage your saved system configurations</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-semibold text-white transition-all hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          New Profile
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red/30 bg-red-dim/20 p-4">
          <AlertCircle className="h-5 w-5 text-red" />
          <p className="flex-1 text-sm text-red">{error}</p>
          <button onClick={() => setError('')}><X className="h-4 w-4 text-red" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-card py-20 text-center">
          <User className="mx-auto mb-4 h-14 w-14 text-text-muted" />
          <h2 className="mb-2 text-xl font-semibold">No profiles yet</h2>
          <p className="mb-6 text-text-secondary">Create your first profile to get started</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-all hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            Create Profile
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="group rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-border-active hover:bg-bg-card-hover"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{profile.name}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                    {profile.type === 'laptop' ? <Laptop className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                    {profile.type === 'laptop' ? 'Laptop' : 'Desktop'}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(profile)}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-primary hover:text-accent"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {deleteConfirm === profile.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteProfile(profile.id)}
                        disabled={deletingId === profile.id}
                        className="rounded-lg bg-red px-2 py-1 text-xs font-medium text-white hover:bg-red/80"
                      >
                        {deletingId === profile.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded-lg bg-bg-primary px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(profile.id)}
                      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-dim/30 hover:text-red"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Cpu className="h-3.5 w-3.5 text-accent" />
                  <span className="truncate">{profile.cpuId}</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <Monitor className="h-3.5 w-3.5 text-green" />
                  <span className="truncate">{profile.gpuId}</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <MemoryStick className="h-3.5 w-3.5 text-yellow" />
                  <span>{profile.ramGB} GB @ {profile.ramSpeed} MHz</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <HardDrive className="h-3.5 w-3.5 text-purple" />
                  <span>{profile.storageCapacity >= 1024 ? `${profile.storageCapacity / 1024} TB` : `${profile.storageCapacity} GB`} {profile.storageType}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <span className="text-xs text-text-muted">{formatDate(profile.createdAt)}</span>
                <Link
                  href={`/estimate?profile=${profile.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                >
                  Use for Estimation <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-bg-secondary shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Profile' : 'New Profile'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="rounded-lg p-2 text-text-muted hover:bg-bg-card hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Profile Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Gaming PC"
                  className="w-full rounded-lg border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">System Type</label>
                <div className="flex gap-2">
                  {(['desktop', 'laptop'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all ${
                        form.type === t
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-input text-text-secondary hover:border-border-active'
                      }`}
                    >
                      {t === 'desktop' ? <Monitor className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
                      {t === 'desktop' ? 'Desktop' : 'Laptop'}
                    </button>
                  ))}
                </div>
              </div>

              <div ref={cpuRef} className="relative">
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">CPU</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={cpuQuery}
                    onChange={(e) => handleCpuQueryChange(e.target.value)}
                    placeholder="Search CPUs..."
                    className="w-full rounded-lg border border-border bg-bg-input py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
                {form.cpuId && (
                  <p className="mt-1 text-xs text-green">
                    <Check className="mr-1 inline h-3 w-3" />
                    Selected: {form.cpuName}
                  </p>
                )}
                {cpuDropdown && cpus.length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                    {cpus.map((cpu) => (
                      <button
                        key={cpu.id}
                        onClick={() => { setForm({ ...form, cpuId: cpu.id, cpuName: cpu.name }); setCpuDropdown(false); setCpuQuery(cpu.name) }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-bg-card-hover ${form.cpuId === cpu.id ? 'bg-accent/10 text-accent' : 'text-text-primary'}`}
                      >
                        {cpu.name} ({cpu.brand}, {cpu.cores}C/{cpu.threads}T)
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div ref={gpuRef} className="relative">
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">GPU</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={gpuQuery}
                    onChange={(e) => handleGpuQueryChange(e.target.value)}
                    placeholder="Search GPUs..."
                    className="w-full rounded-lg border border-border bg-bg-input py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
                {form.gpuId && (
                  <p className="mt-1 text-xs text-green">
                    <Check className="mr-1 inline h-3 w-3" />
                    Selected: {form.gpuName}
                  </p>
                )}
                {gpuDropdown && gpus.length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                    {gpus.map((gpu) => (
                      <button
                        key={gpu.id}
                        onClick={() => { setForm({ ...form, gpuId: gpu.id, gpuName: gpu.name }); setGpuDropdown(false); setGpuQuery(gpu.name) }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-bg-card-hover ${form.gpuId === gpu.id ? 'bg-accent/10 text-accent' : 'text-text-primary'}`}
                      >
                        {gpu.name} ({gpu.brand}, {gpu.vram}GB VRAM)
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">RAM Amount</label>
                <div className="flex flex-wrap gap-2">
                  {ramOptions.map((gb) => (
                    <button
                      key={gb}
                      onClick={() => setForm({ ...form, ramGB: gb })}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                        form.ramGB === gb
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-input text-text-secondary hover:border-border-active'
                      }`}
                    >
                      {gb} GB
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">RAM Speed (MHz)</label>
                <input
                  type="number"
                  value={form.ramSpeed}
                  onChange={(e) => setForm({ ...form, ramSpeed: Number(e.target.value) })}
                  placeholder="3200"
                  className="w-full rounded-lg border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary">Storage Type</label>
                  <div className="flex gap-2">
                    {storageTypes.map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm({ ...form, storageType: t })}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                          form.storageType === t
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-border bg-bg-input text-text-secondary hover:border-border-active'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary">Storage Capacity</label>
                  <select
                    value={form.storageCapacity}
                    onChange={(e) => setForm({ ...form, storageCapacity: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                  >
                    {storageOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Display Resolution</label>
                <select
                  value={form.displayResolution}
                  onChange={(e) => setForm({ ...form, displayResolution: e.target.value })}
                  className="w-full rounded-lg border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  {resolutions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border p-5">
              <button
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saving || !form.name.trim() || !form.cpuId || !form.gpuId}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'Update' : 'Save'} Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
