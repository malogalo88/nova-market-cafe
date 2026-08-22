import type { BuildParts } from '../types'

export interface CommunityPost {
  id: string
  author: string
  displayName: string
  title: string
  category: string
  blurb: string
  parts: BuildParts
  likes: number
  views: number
  daysAgo: number
  color: string
  comments: { author: string; text: string; when: string }[]
}

export const COMMUNITY_CATEGORIES = [
  'Best Budget Build', 'Best Gaming PC', 'Best Looking PC', 'Best Value',
  'Most Powerful', 'First PC', 'Battlestations',
]

export const SEED_POSTS: CommunityPost[] = [
  {
    id: 'p1', author: 'framechaser', displayName: 'Frame Chaser', color: '#22d3ee',
    title: '$650 1080p beast — 200+ FPS in Valorant',
    category: 'Best Value', blurb: 'Every dollar went to FPS. No RGB tax, no overpriced motherboard.',
    parts: { cpu: 'i5-12400f', gpu: 'rtx-4060', mb: 'b660m', ram: 'ripjaws-32-d4', storage: 'sn580-1tb', psu: 'cv650', cooler: 'ak400', case: 'pop-air' },
    likes: 342, views: 5120, daysAgo: 2,
    comments: [
      { author: 'budgetbuilds', text: 'This is basically the value king right now.', when: '1d' },
      { author: 'novaqt', text: 'How is the AK400 on the 12400F? Temps?', when: '22h' },
    ],
  },
  {
    id: 'p2', author: 'arcticforge', displayName: 'Arctic Forge', color: '#a78bfa',
    title: 'All-White XTX build — "Glacier"',
    category: 'Best Looking PC', blurb: 'White everything, UNI fans, and it still pushes 4K.',
    parts: { cpu: 'r7-7800x3d', gpu: 'rx-7900xtx', mb: 'b650', ram: 'trident-32-d5', storage: '990pro-2tb', psu: 'rm750e', cooler: 'lf3-240', case: 'xt-pro-ultra', fans: 'uni-sl120' },
    likes: 587, views: 8430, daysAgo: 4,
    comments: [{ author: 'cablemgmt', text: 'The fan cohesion is unreal. W build.', when: '3d' }],
  },
  {
    id: 'p3', author: 'firstspark', displayName: 'First Spark', color: '#34d399',
    title: 'My first PC ever! (Budget Gaming)',
    category: 'First PC', blurb: 'Saved for 8 months. PCForge caught that my RAM was DDR4 vs a DDR5 board — saved me a return.',
    parts: { cpu: 'r5-5600', gpu: 'rx-6600', mb: 'b550m', ram: 'vengeance-16-d4', storage: 'mx500-1tb', psu: 'evga-600b', cooler: 'se214', case: 'pop-air' },
    likes: 214, views: 3980, daysAgo: 6,
    comments: [
      { author: 'modmail', text: 'Welcome to the club!', when: '5d' },
      { author: 'ssd_enjoyer', text: 'Consider an NVMe upgrade later, loads are night and day.', when: '4d' },
    ],
  },
  {
    id: 'p4', author: 'teraflop', displayName: 'Teraflop', color: '#fbbf24',
    title: 'Titan-class: 5080 + 9800X3D, zero compromises',
    category: 'Most Powerful', blurb: 'The fastest thing this side of a liquid-cooled 4090.',
    parts: { cpu: 'r7-9800x3d', gpu: 'rtx-5080', mb: 'x670e', ram: 'trident-32-d5', storage: '990pro-2tb', psu: 'rm1000e', cooler: 'lf3-360', case: 'lancool-216' },
    likes: 468, views: 7210, daysAgo: 8,
    comments: [{ author: 'voltjunkie', text: 'That PSU headroom though 👌', when: '6d' }],
  },
  {
    id: 'p5', author: 'deskmatdave', displayName: 'Deskmat Dave', color: '#f472b6',
    title: 'Battlestation: warm wood + black SFF',
    category: 'Battlestations', blurb: 'NR200P on a walnut desk, OLED above. Cozy 1440p/240Hz.',
    parts: { cpu: 'r5-7600', gpu: 'rx-7600', mb: 'b650i', ram: 'delta-16-d5', storage: 'sn580-1tb', psu: 'pure-650', cooler: 'ak400', case: 'nr200p', monitor: 'lg-27gr95qe', mouse: 'gpx2', keyboard: 'keychron-k3' },
    likes: 301, views: 4560, daysAgo: 11,
    comments: [{ author: 'plantdad', text: 'The plant placement is doing numbers.', when: '9d' }],
  },
  {
    id: 'p6', author: 'streamline', displayName: 'StreamLine', color: '#38bdf8',
    title: 'Streaming rig that doubles as a render node',
    category: 'Best Gaming PC', blurb: '14700K handles NVENC + gameplay while the GRE eats 1440p.',
    parts: { cpu: 'i7-14700k', gpu: 'rx-7900gre', mb: 'z790', ram: 'trident-32-d5', storage: '990pro-2tb', psu: 'focus-850', cooler: 'lf3-360', case: 'lancool-216' },
    likes: 276, views: 4120, daysAgo: 13,
    comments: [],
  },
  {
    id: 'p7', author: 'pennywise', displayName: 'Penny Wise', color: '#fb7185',
    title: 'Cheapest PC I would actually recommend ($572)',
    category: 'Best Budget Build', blurb: 'Entry-level done right — new parts only, no sketchy PSUs.',
    parts: { cpu: 'i3-12100f', gpu: 'rx-6600', mb: 'b660m', ram: 'vengeance-16-d4', storage: 'p3-500', psu: 'evga-600b', cooler: 'se214', case: 'pop-air' },
    likes: 189, views: 3340, daysAgo: 15,
    comments: [{ author: 'gpuless', text: 'Recommending this to my little brother.', when: '12d' }],
  },
]

export interface Challenge {
  id: string
  name: string
  desc: string
  budget?: number
  entries: number
  endsIn: string
}

export const CHALLENGES: Challenge[] = [
  { id: 'c1', name: 'Best $800 Gaming PC', budget: 800, desc: 'Maximum frames per dollar at 1080p. Tower only.', entries: 128, endsIn: '6d' },
  { id: 'c2', name: 'Best 1080p Build Under $700', budget: 700, desc: 'Prove that cheap can still be good.', entries: 94, endsIn: '12d' },
  { id: 'c3', name: 'Best White PC', desc: 'Aesthetics matter. Snow-white builds only.', entries: 61, endsIn: '9d' },
  { id: 'c4', name: 'Most FPS Per Dollar', desc: 'Any budget. The leaderboard decides.', entries: 203, endsIn: '15d' },
]
