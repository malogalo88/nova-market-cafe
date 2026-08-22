import type { BuildParts } from '../types'

export interface Prebuilt {
  id: string
  name: string
  tags: string[]
  blurb: string
  parts: BuildParts
}

// Tower-only prices (OS & peripherals optional). Prices/stats are computed
// live from the component database so they always stay consistent.

export const PREBUILTS: Prebuilt[] = [
  {
    id: 'forge-starter',
    name: 'Forge Starter',
    tags: ['Entry-Level', 'Budget Gaming'],
    blurb: 'A true entry point for 1080p esports and older AAA titles.',
    parts: { cpu: 'i3-12100f', gpu: 'rx-6600', mb: 'b660m', ram: 'vengeance-16-d4', storage: 'p3-500', psu: 'evga-600b', cooler: 'se214', case: 'pop-air' },
  },
  {
    id: 'forge-core-1080',
    name: 'Forge Core 1080',
    tags: ['1080p Gaming', 'Budget Gaming'],
    blurb: 'Solid high-refresh 1080p gaming without wasting a dollar.',
    parts: { cpu: 'i5-12400f', gpu: 'rtx-4060', mb: 'b660m', ram: 'ripjaws-32-d4', storage: 'sn580-1tb', psu: 'cv650', cooler: 'ak400', case: 'h5-flow' },
  },
  {
    id: 'forge-value-1440',
    name: 'Forge Value 1440',
    tags: ['1440p Gaming', 'Best Value'],
    blurb: 'Our best FPS-per-dollar pick for 1440p. Modern AM5 platform.',
    parts: { cpu: 'r5-7600', gpu: 'rx-7700xt', mb: 'b650m', ram: 'vengeance-32-d5', storage: 'nv2-2tb', psu: 'pure-650', cooler: 'pa120', case: 'air903-white' },
  },
  {
    id: 'forge-performance-1440',
    name: 'Forge Performance 1440',
    tags: ['1440p Gaming', 'High-End'],
    blurb: 'X3D cache + RTX 4070 SUPER: elite 1440p frame rates.',
    parts: { cpu: 'r7-7800x3d', gpu: 'rtx-4070s', mb: 'b650', ram: 'trident-32-d5', storage: '990pro-1tb', psu: 'rm750e', cooler: 'lf3-240', case: 'lancool-216' },
  },
  {
    id: 'forge-stream',
    name: 'Forge Stream',
    tags: ['Streaming', 'Creator'],
    blurb: 'Plenty of cores for encoding while you play at high settings.',
    parts: { cpu: 'i7-14700k', gpu: 'rx-7900gre', mb: 'b760m', ram: 'trident-32-d5', storage: '990pro-2tb', psu: 'focus-850', cooler: 'nh-d15', case: 'xt-pro-ultra' },
  },
  {
    id: 'forge-creator',
    name: 'Forge Creator',
    tags: ['Creator', 'Workstation'],
    blurb: '12 cores, 64GB and a 16GB GPU for editing, rendering and more.',
    parts: { cpu: 'r9-7900x', gpu: 'rtx-4070tis', mb: 'x670e', ram: 'fury-64-d5', storage: '990pro-2tb', psu: 'focus-850', cooler: 'lf3-360', case: 'lancool-216' },
  },
  {
    id: 'forge-apex-4k',
    name: 'Forge Apex 4K',
    tags: ['4K Gaming', 'High-End'],
    blurb: 'True 4K gaming with headroom for max settings.',
    parts: { cpu: 'r7-7800x3d', gpu: 'rtx-4080s', mb: 'x670e', ram: 'trident-32-d5', storage: '990pro-2tb', psu: 'rm1000e', cooler: 'lf3-360', case: 'lancool-216' },
  },
  {
    id: 'forge-titan',
    name: 'Forge Titan',
    tags: ['Enthusiast', 'High-End', 'Most Powerful'],
    blurb: 'The best gaming silicon we stock, in one machine.',
    parts: { cpu: 'r7-9800x3d', gpu: 'rtx-5080', mb: 'x670e', ram: 'trident-32-d5', storage: '990pro-2tb', psu: 'rm1000e', cooler: 'lf3-360', case: 'lancool-216' },
  },
  {
    id: 'forge-compact',
    name: 'Forge Compact',
    tags: ['Compact', '1080p Gaming'],
    blurb: 'Small-form-factor build that fits in a backpack.',
    parts: { cpu: 'r5-7600', gpu: 'rx-7600', mb: 'b650i', ram: 'delta-16-d5', storage: 'sn580-1tb', psu: 'pure-650', cooler: 'ak400', case: 'nr200p' },
  },
  {
    id: 'forge-white-dream',
    name: 'Forge White Dream',
    tags: ['Best Looking', 'Enthusiast', '1440p Gaming'],
    blurb: 'All-white, fully RGB showpiece that still shreds benchmarks.',
    parts: { cpu: 'r7-7800x3d', gpu: 'rx-7900xtx', mb: 'b650', ram: 'trident-32-d5', storage: '990pro-1tb', psu: 'rm750e', cooler: 'lf3-240', case: 'xt-pro-ultra', fans: 'uni-sl120' },
  },
]

export const PREBUILT_TAGS = [
  'Budget Gaming', '1080p Gaming', '1440p Gaming', '4K Gaming', 'Streaming',
  'Creator', 'Workstation', 'Entry-Level', 'High-End', 'Enthusiast',
]
