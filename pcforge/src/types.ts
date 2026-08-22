export type Socket = 'AM4' | 'AM5' | 'LGA1700'
export type FormFactor = 'ATX' | 'Micro-ATX' | 'Mini-ITX'
export type RamType = 'DDR4' | 'DDR5'
export type Resolution = '720p' | '1080p' | '1440p' | '4K'
export type Setting = 'Low' | 'Medium' | 'High' | 'Ultra'

export interface BasePart {
  id: string
  name: string
  brand: string
  price: number
  msrp?: number
  rating: number
  year?: number
}

export interface CPU extends BasePart {
  cat: 'cpu'
  socket: Socket
  cores: number
  threads: number
  boost: number
  tdp: number
  gaming: number // relative gaming score, 100 = best in DB
  multi: number // multi-core / productivity score
  igpu: boolean
}

export interface GPU extends BasePart {
  cat: 'gpu'
  vram: number
  tdp: number
  length: number // mm
  perf: number // relative perf index, 100 = best in DB
  connectors: string
  recPsu: number
}

export interface MB extends BasePart {
  cat: 'mb'
  socket: Socket
  form: FormFactor
  ramType: RamType
  maxRam: number
  m2: number
  sata: number
  wifi: boolean
  biosNote?: string
}

export interface RAM extends BasePart {
  cat: 'ram'
  type: RamType
  gb: number
  sticks: number
  mhz: number
  rgb: boolean
}

export interface Storage extends BasePart {
  cat: 'storage'
  kind: 'NVMe SSD' | 'SATA SSD' | 'HDD'
  iface: 'PCIe 4.0' | 'PCIe 3.0' | 'SATA'
  gb: number
  read: number // MB/s
}

export interface PSU extends BasePart {
  cat: 'psu'
  watts: number
  cert: string
  modular: boolean
}

export interface Case extends BasePart {
  cat: 'case'
  supports: FormFactor[]
  gpuMm: number
  coolerMm: number
  radiator: number[] // supported radiator sizes
  color: 'Black' | 'White'
}

export interface Cooler extends BasePart {
  cat: 'cooler'
  kind: 'Air' | 'AIO'
  sockets: Socket[]
  heightMm?: number
  radiator?: number
  capacity: number // max cooling capacity in W
  noise: number // dBA under load, lower = quieter
}

export interface FanSet extends BasePart {
  cat: 'fans'
  count: number
  rgb: boolean
  quiet: boolean
}

export interface OSPart extends BasePart {
  cat: 'os'
  note?: string
}

export interface Monitor extends BasePart {
  cat: 'monitor'
  res: Resolution
  hz: number
  size: number
  panel: string
}

export interface Peripheral extends BasePart {
  cat: 'keyboard' | 'mouse' | 'headset' | 'wifi'
  spec: string
  wireless?: boolean
}

export type Part =
  | CPU | GPU | MB | RAM | Storage | PSU | Case | Cooler | FanSet | OSPart | Monitor | Peripheral

export type Cat = Part['cat']

export interface BuildParts {
  cpu?: string; gpu?: string; mb?: string; ram?: string; storage?: string
  psu?: string; cooler?: string; case?: string; fans?: string; os?: string
  monitor?: string; keyboard?: string; mouse?: string; headset?: string; wifi?: string
}

export interface Game {
  id: string
  name: string
  demand: number // GPU demand multiplier (higher = heavier)
  cpuLoad: number // how CPU-bound the game is (0-1)
  genre: string
  note?: string
  unreleased?: boolean
}

export interface FpsEstimate {
  avg: number
  low1: number
  min: number
  max: number
  gpuUtil: number
  cpuUtil: number
  limitedBy: 'cpu' | 'gpu'
}

export interface CompatIssue {
  level: 'error' | 'warn' | 'ok'
  title: string
  detail: string
  fixCat?: Cat
  fixIds?: string[]
}

export interface ScoreBreakdown {
  overall: number
  performance: number
  value: number
  compat: number
  upgradeability: number
  efficiency: number
  notes: Record<string, string>
}

export interface SavedBuild {
  id: string
  name: string
  date: number
  parts: BuildParts
  notes?: string
}

export interface UserAccount {
  username: string
  email: string
  pass: string
  bio: string
  joined: number
  following: string[]
}
