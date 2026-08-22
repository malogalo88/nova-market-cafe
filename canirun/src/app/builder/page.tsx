'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  Laptop,
  Search,
  Save,
  Gamepad2,
  Loader2,
  ChevronDown,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'

interface Hardware {
  id: string
  name: string
  cores?: number
  threads?: number
  clockSpeed?: number
  baseClock?: number
  boostClock?: number
  performanceScore?: number
  vram?: number
  tdp?: number
  type?: string
  brand?: string
}

interface LaptopModel {
  id: string
  name: string
  cpuId?: string
  cpu?: Hardware
  gpuId?: string
  gpu?: Hardware
  ram?: number
}

interface ProfilePayload {
  name: string
  systemType: 'desktop' | 'laptop'
  cpuId?: string
  gpuId?: string
  ram: number
  storageType: string
  storageCapacity: number
  resolution: string
  laptopModelId?: string
}

const RAM_OPTIONS = [4, 8, 16, 32, 64, 128]

const STORAGE_TYPES = [
  { value: 'hdd', label: 'HDD' },
  { value: 'ssd', label: 'SSD' },
  { value: 'nvme', label: 'NVMe' },
]

const RESOLUTIONS = [
  { value: '720p', label: '720p (HD)', score: 1 },
  { value: '1080p', label: '1080p (FHD)', score: 2 },
  { value: '1440p', label: '1440p (QHD)', score: 3 },
  { value: '4k', label: '4K (UHD)', score: 4 },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

function SearchableSelect({
  label,
  icon: Icon,
  value,
  onSelect,
  fetchUrl,
  formatOption,
  placeholder,
  required,
  disabled,
  extraParams,
}: {
  label: string
  icon: React.ElementType
  value: string
  onSelect: (item: Hardware | null) => void
  fetchUrl: string
  formatOption: (item: Hardware) => string
  placeholder: string
  required?: boolean
  disabled?: boolean
  extraParams?: string
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Hardware[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!isOpen) return
    const url = `${fetchUrl}?q=${encodeURIComponent(debouncedQuery)}${extraParams ? `&${extraParams}` : ''}`
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(url)
        const data = await res.json()
        setOptions(Array.isArray(data) ? data : [])
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    })()
  }, [debouncedQuery, fetchUrl, isOpen, extraParams])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (item: Hardware) => {
      setSelectedLabel(formatOption(item))
      onSelect(item)
      setIsOpen(false)
      setQuery('')
    },
    [formatOption, onSelect]
  )

  const clear = useCallback(() => {
    setSelectedLabel('')
    onSelect(null)
    setQuery('')
  }, [onSelect])

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Icon className="h-4 w-4 text-accent" />
        {label}
        {required && <span className="text-red">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsOpen(!isOpen)
            setQuery('')
          }}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-left text-sm transition-colors hover:border-border-active disabled:opacity-50"
        >
          <span className={selectedLabel ? 'text-text-primary' : 'text-text-muted'}>
            {selectedLabel || placeholder}
          </span>
          <div className="flex items-center gap-2">
            {selectedLabel && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  clear()
                }}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-bg-card shadow-xl">
            <div className="border-b border-border p-2">
              <div className="flex items-center gap-2 rounded-md bg-bg-primary px-3 py-2">
                <Search className="h-4 w-4 text-text-muted" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                </div>
              ) : options.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">No results found</p>
              ) : (
                options.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-bg-card-hover"
                  >
                    {formatOption(item)}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BuilderPage() {
  const router = useRouter()

  const [systemType, setSystemType] = useState<'desktop' | 'laptop'>('desktop')
  const [cpu, setCpu] = useState<Hardware | null>(null)
  const [gpu, setGpu] = useState<Hardware | null>(null)
  const [ram, setRam] = useState(16)
  const [storageType, setStorageType] = useState('nvme')
  const [storageCapacity, setStorageCapacity] = useState(512)
  const [resolution, setResolution] = useState('1080p')
  const [laptopModel, setLaptopModel] = useState<LaptopModel | null>(null)
  const [laptopModels, setLaptopModels] = useState<LaptopModel[]>([])
  const [laptopSearch, setLaptopSearch] = useState('')
  const [laptopOpen, setLaptopOpen] = useState(false)
  const [laptopLoading, setLaptopLoading] = useState(false)
  const debouncedLaptopQuery = useDebounce(laptopSearch, 300)

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const laptopWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (systemType !== 'laptop' || !laptopOpen) return
    ;(async () => {
      setLaptopLoading(true)
      try {
        const res = await fetch(`/api/hardware/laptops?q=${encodeURIComponent(debouncedLaptopQuery)}`)
        const data = await res.json()
        setLaptopModels(Array.isArray(data) ? data : [])
      } catch {
        setLaptopModels([])
      } finally {
        setLaptopLoading(false)
      }
    })()
  }, [debouncedLaptopQuery, systemType, laptopOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (laptopWrapperRef.current && !laptopWrapperRef.current.contains(e.target as Node)) {
        setLaptopOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectLaptop = useCallback((model: LaptopModel) => {
    setLaptopModel(model)
    if (model.cpu) setCpu(model.cpu)
    if (model.gpu) setGpu(model.gpu)
    if (model.ram) setRam(model.ram)
    setLaptopOpen(false)
    setLaptopSearch('')
  }, [])

  const cpuScore = cpu?.performanceScore ?? 0
  const gpuScore = gpu?.performanceScore ?? 0
  const ramScore = Math.min((ram / 64) * 100, 100)
  const storageScore =
    storageType === 'nvme' ? 90 : storageType === 'ssd' ? 70 : 40
  const resolutionScore =
    RESOLUTIONS.find((r) => r.value === resolution)?.score ?? 2

  const radarData = [
    { subject: 'CPU', value: cpuScore },
    { subject: 'GPU', value: gpuScore },
    { subject: 'RAM', value: ramScore },
    { subject: 'Storage', value: storageScore },
    { subject: 'Resolution', value: (resolutionScore / 4) * 100 },
  ]

  const canSave = !!cpu && !!gpu

  const handleSave = async () => {
    setSaveError('')
    setSaveSuccess(false)
    setSaving(true)

    const payload: ProfilePayload = {
      name: `Build ${new Date().toLocaleDateString()}`,
      systemType,
      cpuId: cpu?.id,
      gpuId: gpu?.id,
      ram,
      storageType,
      storageCapacity,
      resolution,
      laptopModelId: laptopModel?.id,
    }

    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCheckGame = () => {
    const params = new URLSearchParams()
    if (cpu?.id) params.set('cpu', cpu.id)
    if (gpu?.id) params.set('gpu', gpu.id)
    params.set('ram', String(ram))
    params.set('storage', storageType)
    params.set('storageCapacity', String(storageCapacity))
    params.set('resolution', resolution)
    router.push(`/estimate?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-bold">PC Builder</h1>
        <p className="mb-10 text-text-secondary">
          Configure your system and check game compatibility.
        </p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          {/* Main Form */}
          <div className="space-y-6">
            {/* System Type */}
            <section className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <Laptop className="h-5 w-5 text-accent" />
                System Type
              </h2>
              <div className="flex gap-3">
                {(['desktop', 'laptop'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSystemType(type)
                      setLaptopModel(null)
                    }}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      systemType === type
                        ? 'border-border-active bg-accent/10 text-accent'
                        : 'border-border bg-bg-primary text-text-secondary hover:border-border-active'
                    }`}
                  >
                    {type === 'desktop' ? 'Desktop' : 'Laptop'}
                  </button>
                ))}
              </div>
            </section>

            {/* CPU */}
            <section className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <Cpu className="h-5 w-5 text-accent" />
                CPU
              </h2>
              <SearchableSelect
                label="Processor"
                icon={Cpu}
                value={cpu?.id ?? ''}
                onSelect={setCpu}
                fetchUrl="/api/hardware/cpus"
                placeholder="Search for a CPU..."
                formatOption={(item) =>
                  `${item.name}${item.cores ? ` - ${item.cores}C/${item.threads}T` : ''}${item.clockSpeed ? ` @ ${item.clockSpeed}GHz` : ''}${item.performanceScore ? ` (Score: ${item.performanceScore})` : ''}`
                }
              />
              {cpu && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {cpu.cores && (
                    <div className="rounded-lg bg-bg-primary px-3 py-2 text-center">
                      <p className="text-xs text-text-muted">Cores</p>
                      <p className="font-medium">{cpu.cores}</p>
                    </div>
                  )}
                  {cpu.threads && (
                    <div className="rounded-lg bg-bg-primary px-3 py-2 text-center">
                      <p className="text-xs text-text-muted">Threads</p>
                      <p className="font-medium">{cpu.threads}</p>
                    </div>
                  )}
                  {cpu.clockSpeed && (
                    <div className="rounded-lg bg-bg-primary px-3 py-2 text-center">
                      <p className="text-xs text-text-muted">Clock</p>
                      <p className="font-medium">{cpu.clockSpeed} GHz</p>
                    </div>
                  )}
                  {cpu.performanceScore != null && (
                    <div className="rounded-lg bg-bg-primary px-3 py-2 text-center">
                      <p className="text-xs text-text-muted">Score</p>
                      <p className="font-medium text-accent">{cpu.performanceScore}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* GPU */}
            <section className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <Monitor className="h-5 w-5 text-accent" />
                GPU
              </h2>
              <SearchableSelect
                label="Graphics Card"
                icon={Monitor}
                value={gpu?.id ?? ''}
                onSelect={setGpu}
                fetchUrl="/api/hardware/gpus"
                placeholder="Search for a GPU..."
                extraParams={systemType === 'laptop' ? 'isLaptop=true' : undefined}
                formatOption={(item) =>
                  `${item.name}${item.vram ? ` - ${item.vram}GB VRAM` : ''}${item.tdp ? ` (${item.tdp}W)` : ''}${item.performanceScore ? ` (Score: ${item.performanceScore})` : ''}`
                }
              />
              {gpu && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {gpu.vram && (
                    <div className="rounded-lg bg-bg-primary px-3 py-2 text-center">
                      <p className="text-xs text-text-muted">VRAM</p>
                      <p className="font-medium">{gpu.vram} GB</p>
                    </div>
                  )}
                  {gpu.tdp && (
                    <div className="rounded-lg bg-bg-primary px-3 py-2 text-center">
                      <p className="text-xs text-text-muted">TDP</p>
                      <p className="font-medium">{gpu.tdp}W</p>
                    </div>
                  )}
                  {gpu.performanceScore != null && (
                    <div className="rounded-lg bg-bg-primary px-3 py-2 text-center">
                      <p className="text-xs text-text-muted">Score</p>
                      <p className="font-medium text-accent">{gpu.performanceScore}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* RAM */}
            <section className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <MemoryStick className="h-5 w-5 text-accent" />
                RAM
              </h2>
              <div className="flex flex-wrap gap-2">
                {RAM_OPTIONS.map((gb) => (
                  <button
                    key={gb}
                    onClick={() => setRam(gb)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                      ram === gb
                        ? 'border-border-active bg-accent/10 text-accent'
                        : 'border-border bg-bg-primary text-text-secondary hover:border-border-active'
                    }`}
                  >
                    {gb} GB
                  </button>
                ))}
              </div>
            </section>

            {/* Storage */}
            <section className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <HardDrive className="h-5 w-5 text-accent" />
                Storage
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                    Type
                  </label>
                  <div className="flex gap-2">
                    {STORAGE_TYPES.map((st) => (
                      <button
                        key={st.value}
                        onClick={() => setStorageType(st.value)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          storageType === st.value
                            ? 'border-border-active bg-accent/10 text-accent'
                            : 'border-border bg-bg-primary text-text-secondary hover:border-border-active'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                    Capacity (GB)
                  </label>
                  <input
                    type="number"
                    min={32}
                    max={8000}
                    step={32}
                    value={storageCapacity}
                    onChange={(e) => setStorageCapacity(Number(e.target.value) || 32)}
                    className="w-full rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-border-active"
                  />
                </div>
              </div>
            </section>

            {/* Resolution */}
            <section className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <Monitor className="h-5 w-5 text-accent" />
                Display Resolution
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.value}
                    onClick={() => setResolution(res.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                      resolution === res.value
                        ? 'border-border-active bg-accent/10 text-accent'
                        : 'border-border bg-bg-primary text-text-secondary hover:border-border-active'
                    }`}
                  >
                    {res.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Laptop Model (conditional) */}
            {systemType === 'laptop' && (
              <section className="rounded-xl border border-border bg-bg-card p-6">
                <h2 className="mb-4 flex items-center gap-2 font-semibold">
                  <Laptop className="h-5 w-5 text-accent" />
                  Laptop Model
                  <span className="text-xs text-text-muted">(auto-fills CPU, GPU, RAM)</span>
                </h2>
                <div ref={laptopWrapperRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setLaptopOpen(!laptopOpen)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-left text-sm transition-colors hover:border-border-active"
                  >
                    <span className={laptopModel ? 'text-text-primary' : 'text-text-muted'}>
                      {laptopModel?.name || 'Search for a laptop model...'}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-text-muted transition-transform ${laptopOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {laptopOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-bg-card shadow-xl">
                      <div className="border-b border-border p-2">
                        <div className="flex items-center gap-2 rounded-md bg-bg-primary px-3 py-2">
                          <Search className="h-4 w-4 text-text-muted" />
                          <input
                            autoFocus
                            type="text"
                            value={laptopSearch}
                            onChange={(e) => setLaptopSearch(e.target.value)}
                            placeholder="Search laptop models..."
                            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {laptopLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-accent" />
                          </div>
                        ) : laptopModels.length === 0 ? (
                          <p className="py-4 text-center text-sm text-text-muted">
                            No laptops found
                          </p>
                        ) : (
                          laptopModels.map((model) => (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => selectLaptop(model)}
                              className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-bg-card-hover"
                            >
                              {model.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            {/* Build Summary */}
            <div className="rounded-xl border border-border bg-bg-card p-6">
              <h3 className="mb-4 font-semibold">Build Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">System</span>
                  <span className="capitalize text-text-primary">{systemType}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex justify-between">
                  <span className="text-text-muted">CPU</span>
                  <span className="max-w-[180px] truncate text-right text-text-primary">
                    {cpu?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">GPU</span>
                  <span className="max-w-[180px] truncate text-right text-text-primary">
                    {gpu?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">RAM</span>
                  <span className="text-text-primary">{ram} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Storage</span>
                  <span className="text-text-primary">
                    {storageCapacity} GB {storageType.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Resolution</span>
                  <span className="text-text-primary">{resolution}</span>
                </div>
              </div>

              {!canSave && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow/5 p-3 text-xs text-yellow">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Select a CPU and GPU to enable saving and game checks.
                </div>
              )}
            </div>

            {/* Performance Chart */}
            {(cpu || gpu) && (
              <div className="rounded-xl border border-border bg-bg-card p-6">
                <h3 className="mb-4 font-semibold">Performance Overview</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#2a2a4a" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: '#8888a8', fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: '#5a5a7a', fontSize: 10 }}
                    />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="#6c63ff"
                      fill="#6c63ff"
                      fillOpacity={0.25}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Profile
              </button>

              <button
                onClick={handleCheckGame}
                disabled={!canSave}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-6 py-3 font-semibold text-text-primary transition-all hover:border-border-active hover:bg-bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Gamepad2 className="h-4 w-4" />
                Check a Game
              </button>

              {saveSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-green/10 p-3 text-sm text-green">
                  <CheckCircle2 className="h-4 w-4" />
                  Profile saved successfully!
                </div>
              )}
              {saveError && (
                <div className="flex items-center gap-2 rounded-lg bg-red/10 p-3 text-sm text-red">
                  <AlertCircle className="h-4 w-4" />
                  {saveError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
