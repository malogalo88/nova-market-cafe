export interface Guide {
  id: string
  title: string
  minutes: number
  level: 'Beginner' | 'Intermediate'
  tags: string[]
  body: string[]
}

export const GUIDES: Guide[] = [
  {
    id: 'how-to-build', title: 'How to build a PC', minutes: 9, level: 'Beginner', tags: ['basics'],
    body: [
      'Building a PC is mostly careful plugging-in. Prepare a clear workspace, keep the motherboard box as a stand, and touch a metal part of the case occasionally to discharge static.',
      'A safe order: install CPU + RAM + M.2 SSD onto the motherboard first, then mount the motherboard in the case, then the PSU, cooler, GPU and cables. The CPU drops in with zero force — align the triangle markers.',
      'Connect the 24-pin and 8-pin EPS power to the board, front-panel headers per the manual, and GPU power last. Then press the power button — if fans spin and you see the BIOS screen, you have basically finished.',
    ],
  },
  {
    id: 'how-much-ram', title: 'How much RAM do I need?', minutes: 4, level: 'Beginner', tags: ['ram'],
    body: [
      '8GB is no longer comfortable for modern gaming; 16GB is today\'s practical minimum, and 32GB removes any doubt for gaming plus streaming or heavy browser use.',
      'Speed matters too: for DDR4 aim for 3200–3600 MHz, for DDR5 aim for 5600–6000 MHz. Always install sticks in pairs so the system can use dual-channel bandwidth.',
      'Enable XMP (Intel) or EXPO (AMD) in the BIOS — otherwise RAM runs at a slower default speed.',
    ],
  },
  {
    id: 'how-much-vram', title: 'How much VRAM do I need?', minutes: 5, level: 'Beginner', tags: ['gpu'],
    body: [
      'VRAM is your graphics card\'s own memory. Higher resolutions and texture settings consume more of it.',
      'For 1080p, 8GB is generally fine today. For 1440p, 12GB is a safer target, and for 4K or heavy texture mods, 16GB+ keeps settings open.',
      'When VRAM runs out, frame rates fall off a cliff — it is better to have a little headroom than a faster core with too little memory.',
    ],
  },
  {
    id: 'cpu-vs-gpu', title: 'CPU vs GPU: what matters more?', minutes: 6, level: 'Beginner', tags: ['cpu', 'gpu'],
    body: [
      'The GPU renders frames; the CPU prepares them. In fast esports titles at low settings, the CPU often limits FPS. In graphically rich games at high resolution, the GPU dominates.',
      'A balanced rule of thumb: pair mid-range CPUs with mid-range GPUs and top GPUs with strong CPUs (like X3D chips) to avoid leaving performance on the table.',
      'PCForge\'s bottleneck panel estimates this balance for your exact parts — treat it as guidance, not gospel.',
    ],
  },
  {
    id: 'choose-psu', title: 'How to choose a PSU', minutes: 5, level: 'Beginner', tags: ['psu'],
    body: [
      'Add up your components\' peak draw (PCForge does this automatically), then add 20–30% headroom. Headroom keeps the PSU in its efficient range and leaves room for upgrades.',
      'Buy reputable brands with 80+ Bronze at minimum; Gold is a sweet spot. Modular cables make small cases much easier to build in.',
      'Never reuse a no-name PSU from an old prebuilt with a new GPU — it is the one part that can take everything else down with it.',
    ],
  },
  {
    id: 'resolution-guide', title: '1080p vs 1440p vs 4K', minutes: 5, level: 'Beginner', tags: ['monitor'],
    body: [
      'Resolution multiplies GPU work: 1440p has ~78% more pixels than 1080p, and 4K has ~2.25× more than 1440p.',
      'As a rough guide: budget builds shine at 1080p high-refresh, mid-range GPUs are happiest at 1440p, and true 4K ultra wants a high-end card.',
      'A sharp 1440p 165Hz monitor is the sweet spot for most gamers — 4K is gorgeous but expensive to feed.',
    ],
  },
  {
    id: 'bottlenecking', title: 'What is bottlenecking?', minutes: 4, level: 'Beginner', tags: ['concepts'],
    body: [
      'A bottleneck is simply the slowest link setting the pace. If your CPU can only prepare 90 frames while your GPU could render 160, you get ~90 FPS.',
      'It is normal — every PC has a limiter somewhere. Problems only appear when the gap is huge (a $100 CPU with a $1000 GPU).',
      'Use the Bottleneck panel to see which component leads, and remember: estimates, not guarantees.',
    ],
  },
  {
    id: 'upgrade-pc', title: 'How to upgrade a PC', minutes: 6, level: 'Intermediate', tags: ['upgrades'],
    body: [
      'Upgrade what limits you: check FPS estimates before and after. For most gamers the order is GPU → CPU/platform → RAM → storage.',
      'Check compatibility first: case clearance for longer cards, PSU wattage for hungrier ones, and socket support for new CPUs.',
      'Small quality-of-life wins: add an NVMe SSD, extra case fans, or double your RAM — cheap changes that feel great daily.',
    ],
  },
  {
    id: 'install-windows', title: 'How to install Windows 11', minutes: 5, level: 'Beginner', tags: ['software'],
    body: [
      'Use Microsoft\'s Media Creation Tool on another PC to make a bootable USB (8GB+). Plug it into the new PC and boot from it (usually F12/F11/Del for the boot menu).',
      'Choose "Custom install", select your NVMe drive, and let it copy files. Once you reach the desktop, run Windows Update and install GPU drivers from NVIDIA/AMD/Intel directly.',
      'Tip: you can skip entering a product key during setup and activate later.',
    ],
  },
  {
    id: 'xmp-expo', title: 'How to enable XMP / EXPO', minutes: 3, level: 'Beginner', tags: ['ram', 'bios'],
    body: [
      'RAM ships at a safe default speed (e.g., DDR5-4800). XMP (Intel) and EXPO (AMD) are one-click profiles that unlock your kit\'s rated speed.',
      'Enter the BIOS (Del during boot), find "XMP/EXPO" under memory settings, enable Profile 1, save and reboot.',
      'If the PC fails to boot afterwards, clear CMOS (or wait — most boards retry safe settings automatically) and try a slightly slower profile.',
    ],
  },
  {
    id: 'gaming-performance', title: 'How to improve gaming performance', minutes: 7, level: 'Intermediate', tags: ['fps'],
    body: [
      'Free wins first: enable XMP/EXPO, update GPU drivers, set the Windows power plan to High Performance, and make sure the monitor runs at its max refresh rate.',
      'In-game: cap FPS slightly below your average for consistency, or use upscaling (DLSS/FSR) in demanding titles — it trades a little sharpness for a lot of FPS.',
      'Hardware-wise, GPU upgrades move average FPS the most at higher resolutions; CPU upgrades lift 1% lows and esports ceilings.',
    ],
  },
]
