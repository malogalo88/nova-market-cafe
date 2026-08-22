import { 
  Component, 
  ComponentCategory, 
  ComponentSpecs, 
  SocketType, 
  RamType, 
  FormFactor, 
  CaseSize, 
  CompatibilityIssue,
  Build,
  Recommendation
} from './types/index';

// ============================================
// CPU DATABASE
// ============================================

export const CPUs: Component[] = [
  {
    id: 'cpu-ryzen5-5600',
    name: 'Ryzen 5 5600',
    brand: 'AMD',
    category: 'cpu',
    price: 150,
    image: '/cpu-amd.png',
    specs: {
      socket: 'AM4',
      cores: 6,
      threads: 12,
      baseClock: 3.5,
      boostClock: 4.4,
      tdp: 65,
    },
    performanceScore: 78,
    gamingPerformance: {
      'Minecraft': 180, 'Fortnite': 144, 'Valorant': 220, 
      'GTA V': 110, 'CS2': 240, 'Cyberpunk 2077': 75
    },
    releaseYear: 2020,
    description: 'Popular mid-range Zen 3 processor'
  },
  {
    id: 'cpu-ryzen5-7600',
    name: 'Ryzen 5 7600',
    brand: 'AMD',
    category: 'cpu',
    price: 230,
    image: '/cpu-amd.png',
    specs: {
      socket: 'AM5',
      cores: 6,
      threads: 12,
      baseClock: 3.8,
      boostClock: 5.1,
      tdp: 65,
    },
    performanceScore: 82,
    releaseYear: 2022,
    description: 'Zen 4 processor requiring AM5 platform'
  },
  {
    id: 'cpu-ryzen7-7800x3d',
    name: 'Ryzen 7 7800X3D',
    brand: 'AMD',
    category: 'cpu',
    price: 450,
    image: '/cpu-amd.png',
    specs: {
      socket: 'AM5',
      cores: 8,
      threads: 16,
      baseClock: 4.2,
      boostClock: 5.0,
      tdp: 120,
    },
    performanceScore: 95,
    releaseYear: 2022,
    description: 'Gaming king with 3D V-Cache'
  },
  {
    id: 'cpu-i5-12400f',
    name: 'Core i5-12400F',
    brand: 'Intel',
    category: 'cpu',
    price: 180,
    image: '/cpu-intel.png',
    specs: {
      socket: 'LGA1700',
      cores: 6,
      threads: 12,
      baseClock: 2.5,
      boostClock: 4.4,
      tdp: 65,
    },
    performanceScore: 75,
    gamingPerformance: {
      'Minecraft': 170, 'Fortnite': 135, 'Valorant': 210, 
      'GTA V': 105, 'CS2': 230, 'Cyberpunk 2077': 70
    },
    releaseYear: 2021,
    description: 'Value-focused 12th gen processor'
  },
  {
    id: 'cpu-i5-13400f',
    name: 'Core i5-13400F',
    brand: 'Intel',
    category: 'cpu',
    price: 220,
    image: '/cpu-intel.png',
    specs: {
      socket: 'LGA1700',
      cores: 10,
      threads: 16,
      baseClock: 2.5,
      boostClock: 4.6,
      tdp: 65,
    },
    performanceScore: 80,
    gamingPerformance: {
      'Minecraft': 190, 'Fortnite': 150, 'Valorant': 235, 
      'GTA V': 115, 'CS2': 260, 'Cyberpunk 2077': 78
    },
    releaseYear: 2022,
    description: 'Improved 13th gen value option'
  },
  {
    id: 'cpu-i7-13700k',
    name: 'Core i7-13700K',
    brand: 'Intel',
    category: 'cpu',
    price: 420,
    image: '/cpu-intel.png',
    specs: {
      socket: 'LGA1700',
      cores: 24,
      threads: 32,
      baseClock: 3.4,
      boostClock: 5.4,
      tdp: 253,
    },
    performanceScore: 90,
    gamingPerformance: {
      'Minecraft': 230, 'Fortnite': 175, 'Valorant': 280, 
      'GTA V': 140, 'CS2': 300, 'Cyberpunk 2077': 105
    },
    releaseYear: 2022,
    description: 'High-performance hybrid architecture'
  }
];

// ============================================
// CPU COOLER DATABASE
// ============================================

export const CPU_COOLERS: Component[] = [
  {
    id: 'cooler-cooler-master-t400',
    name: 'Cooler Master T400',
    brand: 'Cooler Master',
    category: 'cpuCooler',
    price: 35,
    image: '/cooler-amd.png',
    specs: {
      coolerType: 'air',
      maxHeight: 155,
      supportedSockets: ['LGA1700', 'LGA1200', 'AM5', 'AM4'],
    },
  },
  {
    id: 'cooler-noctua-u12s',
    name: 'Noctua NH-U12S',
    brand: 'Noctua',
    category: 'cpuCooler',
    price: 65,
    image: '/cooler-noctua.png',
    specs: {
      coolerType: 'air',
      maxHeight: 158,
      supportedSockets: ['LGA1700', 'LGA1200', 'AM5', 'AM4'],
    },
  },
  {
    id: 'cooler-corsair-i100',
    name: 'Corsair iCUE H100i Elite Capellix',
    brand: 'Corsair',
    category: 'cpuCooler',
    price: 130,
    image: '/cooler-corsair.png',
    specs: {
      coolerType: 'aio',
      radiatorSize: 240,
      supportedSockets: ['LGA1700', 'LGA1200', 'AM5', 'AM4'],
    },
  },
  {
    id: 'cooler-cooler-master-masterliquid',
    name: 'Cooler Master MasterLiquid Maker 240',
    brand: 'Cooler Master',
    category: 'cpuCooler',
    price: 110,
    image: '/cooler-corsair.png',
    specs: {
      coolerType: 'aio',
      radiatorSize: 240,
      supportedSockets: ['LGA1700', 'LGA1200', 'AM5', 'AM4'],
    },
  },
  {
    id: 'cooler-be-quiet-shadow-rock',
    name: 'Be Quiet! Shadow Rock LP',
    brand: 'Be Quiet',
    category: 'cpuCooler',
    price: 55,
    image: '/cooler-noctua.png',
    specs: {
      coolerType: 'air',
      maxHeight: 125,
      supportedSockets: ['LGA1700', 'LGA1200', 'AM5', 'AM4'],
    },
  }
];

// ============================================
// MOTHERBOARD DATABASE
// ============================================

export const MOTHERBOARDS: Component[] = [
  {
    id: 'mboard-b550m',
    name: 'MSI B550-A Pro',
    brand: 'MSI',
    category: 'motherboard',
    price: 130,
    image: '/mboard-msi.png',
    specs: {
      chipset: 'B550',
      formFactor: 'ATX',
      ramType: 'DDR4',
      maxRamCapacity: 128,
      ramSlots: 4,
      pcieVersion: '4.0',
      m2Slots: 2,
      sataPorts: 6,
      cpuPowerPhases: 8,
    },
    compatibilityIssues: ['CPU requires LGA1700 or AM5 socket'],
    performanceScore: 70,
    releaseYear: 2020,
    description: 'Solid B550 board for Ryzen processors'
  },
  {
    id: 'mboard-b650',
    name: 'ASRock B650 Taichi',
    brand: 'ASRock',
    category: 'motherboard',
    price: 230,
    image: '/mboard-asrock.png',
    specs: {
      chipset: 'B650',
      formFactor: 'ATX',
      ramType: 'DDR5',
      maxRamCapacity: 128,
      ramSlots: 4,
      pcieVersion: '5.0',
      m2Slots: 3,
      sataPorts: 6,
      cpuPowerPhases: 14,
    },
    performanceScore: 85,
    releaseYear: 2022,
    description: 'Premium B650 with DDR5 and PCIe 5.0'
  },
  {
    id: 'mboard-x570',
    name: 'Gigabyte X570 AORUS Elite',
    brand: 'Gigabyte',
    category: 'motherboard',
    price: 200,
    image: '/mboard-gigabyte.png',
    specs: {
      chipset: 'X570',
      formFactor: 'ATX',
      ramType: 'DDR4',
      maxRamCapacity: 128,
      ramSlots: 4,
      pcieVersion: '4.0',
      m2Slots: 2,
      sataPorts: 6,
      cpuPowerPhases: 12,
    },
    performanceScore: 80,
    releaseYear: 2020,
    description: 'High-end X570 with excellent cooling'
  },
  {
    id: 'mboard-z690',
    name: 'MSI Z690 Gaming Plus',
    brand: 'MSI',
    category: 'motherboard',
    price: 280,
    image: '/mboard-msi.png',
    specs: {
      chipset: 'Z690',
      formFactor: 'ATX',
      ramType: 'DDR5',
      maxRamCapacity: 128,
      ramSlots: 4,
      pcieVersion: '5.0',
      m2Slots: 2,
      sataPorts: 6,
      cpuPowerPhases: 12,
    },
    releaseYear: 2022,
    description: 'Feature-rich Z690 for Intel 12th/13th gen'
  },
  {
    id: 'mboard-b760',
    name: 'ASUS TUF B760M-PLUS',
    brand: 'ASUS',
    category: 'motherboard',
    price: 150,
    image: '/mboard-asus.png',
    specs: {
      chipset: 'B760',
      formFactor: 'Micro-ATX',
      ramType: 'DDR5',
      maxRamCapacity: 128,
      ramSlots: 4,
      pcieVersion: '5.0',
      m2Slots: 2,
      sataPorts: 6,
      cpuPowerPhases: 8,
    },
    performanceScore: 72,
    releaseYear: 2022,
    description: 'Durable Micro-ATX B760 board'
  }
];

// ============================================
// RAM DATABASE
// ============================================

export const RAM: Component[] = [
  {
    id: 'ram-corsair-16gb',
    name: 'Corsair Vengeance 16GB (2x8GB) DDR4',
    brand: 'Corsair',
    category: 'ram',
    price: 55,
    image: '/ram-ddr4.png',
    specs: {
      capacity: 16,
      speed: 3200,
      modules: 2,
      latency: 'CL16',
      voltage: 1.2,
    },
  },
  {
    id: 'ram-corsair-ddr5-32gb',
    name: 'Corsair Vengeance 32GB (2x16GB) DDR5',
    brand: 'Corsair',
    category: 'ram',
    price: 115,
    image: '/ram-ddr5.png',
    specs: {
      capacity: 32,
      speed: 6000,
      modules: 2,
      latency: 'CL30',
      voltage: 1.35,
    },
  },
  {
    id: 'ram-gskill-32gb',
    name: 'G.Skill Ripjaws 32GB (2x16GB) DDR5',
    brand: 'G.Skill',
    category: 'ram',
    price: 130,
    image: '/ram-ddr5.png',
    specs: {
      capacity: 32,
      speed: 6000,
      modules: 2,
      latency: 'CL30',
      voltage: 1.35,
    },
  },
  {
    id: 'ram-corsair-ddr4-32gb',
    name: 'Corsair Vengeance 32GB (2x16GB) DDR4',
    brand: 'Corsair',
    category: 'ram',
    price: 85,
    image: '/ram-ddr4.png',
    specs: {
      capacity: 32,
      speed: 3600,
      modules: 2,
      latency: 'CL18',
      voltage: 1.35,
    },
  }
];

// ============================================
// GPU DATABASE
// ============================================

export const GPUs: Component[] = [
  {
    id: 'gpu-rx-6600',
    name: 'RX 6600',
    brand: 'AMD',
    category: 'gpu',
    price: 250,
    image: '/gpu-rx6600.png',
    specs: {
      vram: 8,
      vramType: 'GDDR6',
      length: 310,
      width: 2,
      tdp: 132,
      powerConnectors: ['8-pin'],
      recommendedPsu: 500,
    },
    performanceScore: 70,
    gamingPerformance: {
      'Minecraft': 120, 'Fortnite': 130, 'Valorant': 200, 
      'GTA V': 90, 'CS2': 180, 'Cyberpunk 2077': 60
    },
  },
  {
    id: 'gpu-rx-7600',
    name: 'RX 7600',
    brand: 'AMD',
    category: 'gpu',
    price: 300,
    image: '/gpu-rx7600.png',
    specs: {
      vram: 8,
      vramType: 'GDDR6',
      length: 297,
      width: 2,
      tdp: 165,
      powerConnectors: ['8-pin'],
      recommendedPsu: 550,
    },
    performanceScore: 75,
    gamingPerformance: {
      'Minecraft': 140, 'Fortnite': 150, 'Valorant': 230, 
      'GTA V': 100, 'CS2': 200, 'Cyberpunk 2077': 68
    },
  },
  {
    id: 'gpu-rtx-4060',
    name: 'RTX 4060',
    brand: 'NVIDIA',
    category: 'gpu',
    price: 300,
    image: '/gpu-rtx4060.png',
    specs: {
      vram: 8,
      vramType: 'GDDR6',
      length: 245,
      width: 2,
      tdp: 170,
      powerConnectors: ['8-pin'],
      recommendedPsu: 550,
    },
    performanceScore: 78,
    gamingPerformance: {
      'Minecraft': 130, 'Fortnite': 155, 'Valorant': 220, 
      'GTA V': 100, 'CS2': 210, 'Cyberpunk 2077': 75
    },
  },
  {
    id: 'gpu-rtx-4060-ti',
    name: 'RTX 4060 Ti 8GB',
    brand: 'NVIDIA',
    category: 'gpu',
    price: 370,
    image: '/gpu-rtx4060.png',
    specs: {
      vram: 8,
      vramType: 'GDDR6',
      length: 265,
      width: 2.5,
      tdp: 165,
      powerConnectors: ['8-pin'],
      recommendedPsu: 600,
    },
    performanceScore: 82,
    gamingPerformance: {
      'Minecraft': 140, 'Fortnite': 165, 'Valorant': 245, 
      'GTA V': 110, 'CS2': 230, 'Cyberpunk 2077': 82
    },
  },
  {
    id: 'gpu-rtx-4070',
    name: 'RTX 4070',
    brand: 'NVIDIA',
    category: 'gpu',
    price: 550,
    image: '/gpu-rtx4070.png',
    specs: {
      vram: 12,
      vramType: 'GDDR6X',
      length: 300,
      width: 2,
      tdp: 200,
      powerConnectors: ['8-pin', '8-pin'],
      recommendedPsu: 700,
    },
    performanceScore: 88,
    gamingPerformance: {
      'Minecraft': 150, 'Fortnite': 175, 'Valorant': 270, 
      'GTA V': 130, 'CS2': 260, 'Cyberpunk 2077': 95
    },
  },
  {
    id: 'gpu-rtx-4070-super',
    name: 'RTX 4070 Super',
    brand: 'NVIDIA',
    category: 'gpu',
    price: 600,
    image: '/gpu-rtx4070.png',
    specs: {
      vram: 12,
      vramType: 'GDDR6X',
      length: 300,
      width: 2,
      tdp: 220,
      powerConnectors: ['8-pin', '8-pin'],
      recommendedPsu: 750,
    },
    performanceScore: 92,
    gamingPerformance: {
      'Minecraft': 165, 'Fortnite': 190, 'Valorant': 295, 
      'GTA V': 145, 'CS2': 280, 'Cyberpunk 2077': 105
    },
  },
  {
    id: 'gpu-rx-7800-xt',
    name: 'RX 7800 XT',
    brand: 'AMD',
    category: 'gpu',
    price: 550,
    image: '/gpu-rx7800.png',
    specs: {
      vram: 16,
      vramType: 'GDDR6',
      length: 320,
      width: 3,
      tdp: 263,
      powerConnectors: ['8-pin', '8-pin'],
      recommendedPsu: 700,
    },
    performanceScore: 90,
    gamingPerformance: {
      'Minecraft': 170, 'Fortnite': 195, 'Valorant': 305, 
      'GTA V': 150, 'CS2': 290, 'Cyberpunk 2077': 110
    },
  }
];

// ============================================
// STORAGE DATABASE
// ============================================

export const STORAGE: Component[] = [
  {
    id: 'ssd-samsung-1tb',
    name: 'Samsung 980 Pro 1TB NVMe',
    brand: 'Samsung',
    category: 'storage',
    price: 85,
    image: '/ssd-samsung.png',
    specs: {
      storageType: 'NVMe',
      capacity: 1,
      interface: 'PCIe 4.0',
      readSpeed: 7000,
      writeSpeed: 5000,
    },
  },
  {
    id: 'ssd-crucial-2tb',
    name: 'Crucial P3 Plus 2TB NVMe',
    brand: 'Crucial',
    category: 'storage',
    price: 130,
    image: '/ssd-crucial.png',
    specs: {
      storageType: 'NVMe',
      capacity: 2,
      interface: 'PCIe 4.0',
      readSpeed: 6800,
      writeSpeed: 5000,
    },
  },
  {
    id: 'ssd-kingston-500gb',
    name: 'Kingston NV2 500GB NVMe',
    brand: 'Kingston',
    category: 'storage',
    price: 40,
    image: '/ssd-kingston.png',
    specs: {
      storageType: 'NVMe',
      capacity: 0.5,
      interface: 'PCIe 3.0',
      readSpeed: 3500,
      writeSpeed: 2100,
    },
  },
  {
    id: 'ssd-kingston-4tb',
    name: 'Kingston KC3000 4TB NVMe',
    brand: 'Kingston',
    category: 'storage',
    price: 320,
    image: '/ssd-kingston.png',
    specs: {
      storageType: 'NVMe',
      capacity: 4,
      interface: 'PCIe 4.0',
      readSpeed: 7000,
      writeSpeed: 5000,
    },
  }
];

// ============================================
// POWER SUPPLY DATABASE
// ============================================

export const PSUs: Component[] = [
  {
    id: 'psu-ecoze-600w',
    name: 'EcoZone 600W 80+ Bronze',
    brand: 'EcoZone',
    category: 'psu',
    price: 55,
    image: '/psu-basic.png',
    specs: {
      wattage: 600,
      efficiency: '80+ Bronze',
      modular: 'non-modular',
      pcieCables: 2,
      cpuCables: 1,
      sataCables: 4,
    },
  },
  {
    id: 'psu-corsair-bronze-750w',
    name: 'Corsair CV750 750W 80+ Bronze',
    brand: 'Corsair',
    category: 'psu',
    price: 70,
    image: '/psu-corsair.png',
    specs: {
      wattage: 750,
      efficiency: '80+ Bronze',
      modular: 'semi-modular',
      pcieCables: 3,
      cpuCables: 1,
      sataCables: 4,
    },
  },
  {
    id: 'psu-gold-850w',
    name: 'Corsair RM850x 850W 80+ Gold',
    brand: 'Corsair',
    category: 'psu',
    price: 120,
    image: '/psu-gold.png',
    specs: {
      wattage: 850,
      efficiency: '80+ Gold',
      modular: 'full-modular',
      pcieCables: 4,
      cpuCables: 1,
      sataCables: 4,
    },
  },
  {
    id: 'psu-platinum-1000w',
    name: 'Seasonic Focus GX-1000 1000W 80+ Platinum',
    brand: 'Seasonic',
    category: 'psu',
    price: 180,
    image: '/psu-seasonic.png',
    specs: {
      wattage: 1000,
      efficiency: '80+ Platinum',
      modular: 'full-modular',
      pcieCables: 5,
      cpuCables: 2,
      sataCables: 4,
    },
  }
];

// ============================================
// CASE DATABASE
// ============================================

export const CASES: Component[] = [
  {
    id: 'case-fractal-define',
    name: 'Fractal Design Meshify C',
    brand: 'Fractal Design',
    category: 'case',
    price: 90,
    image: '/case-fractal.png',
    specs: {
      supportedFormFactors: ['ATX', 'Micro-ATX', 'Mini-ITX'],
      maxGpuLength: 330,
      maxCpuCoolerHeight: 165,
      maxPsuLength: 180,
      fanMounts: [{ size: 120, count: 3 }, { size: 140, count: 2 }],
      radiatorSupport: [{ size: 240, position: 'front' }, { size: 360, position: 'top' }],
      driveBays: { '2.5"': 4, '3.5"': 2 },
    },
    performanceScore: 80,
  },
  {
    id: 'case-cooler-master-q300l',
    name: 'Cooler Master Q300L',
    brand: 'Cooler Master',
    category: 'case',
    price: 75,
    image: '/case-coolermaster.png',
    specs: {
      supportedFormFactors: ['Micro-ATX', 'Mini-ITX'],
      maxGpuLength: 320,
      maxCpuCoolerHeight: 155,
      maxPsuLength: 160,
      fanMounts: [{ size: 120, count: 4 }, { size: 140, count: 2 }],
      radiatorSupport: [{ size: 240, position: 'front' }],
      driveBays: { '2.5"': 4, '3.5"': 1 },
    },
    performanceScore: 75,
  },
  {
    id: 'case-fractal-define-7',
    name: 'Fractal Design Define 7',
    brand: 'Fractal Design',
    category: 'case',
    price: 200,
    image: '/case-fractal.png',
    specs: {
      supportedFormFactors: ['E-ATX', 'ATX'],
      maxGpuLength: 400,
      maxCpuCoolerHeight: 185,
      maxPsuLength: 220,
      fanMounts: [{ size: 140, count: 4 }, { size: 120, count: 2 }],
      radiatorSupport: [{ size: 360, position: 'front' }, { size: 280, position: 'top' }, { size: 240, position: 'rear' }],
      driveBays: { '2.5"': 6, '3.5"': 3 },
    },
    performanceScore: 90,
  }
];

// ============================================
// CASE FANS DATABASE
// ============================================

export const CASE_FANS: Component[] = [
  {
    id: 'fan-coolermaster-sickleflow',
    name: 'Cooler Master SickleFlow 120mm',
    brand: 'Cooler Master',
    category: 'caseFan',
    price: 15,
    image: '/fan-coolermaster.png',
    specs: {
      fanSize: 120,
      rpm: 1500,
      airflow: 78.5,
      staticPressure: 2.62,
      noiseLevel: 25.6,
      pwm: true,
    },
  },
  {
    id: 'fan-fractal-premium',
    name: 'Fractal Design Premium 140mm',
    brand: 'Fractal Design',
    category: 'caseFan',
    price: 20,
    image: '/fan-fractal.png',
    specs: {
      fanSize: 140,
      rpm: 1000,
      airflow: 71.0,
      staticPressure: 1.94,
      noiseLevel: 17.5,
      pwm: true,
    },
  },
  {
    id: 'fan-sp120',
    name: 'NZXT Aer RGB 120mm',
    brand: 'NZXT',
    category: 'caseFan',
    price: 25,
    image: '/fan-nzxt.png',
    specs: {
      fanSize: 120,
      rpm: 1800,
      airflow: 79.0,
      staticPressure: 2.83,
      noiseLevel: 27.0,
      pwm: true,
    },
  }
];

// ============================================
// EXPORT ALL COMPONENTS
// ============================================

export const allComponents: Record<ComponentCategory, Component[]> = {
  cpu: CPUs,
  cpuCooler: CPU_COOLERS,
  motherboard: MOTHERBOARDS,
  ram: RAM,
  gpu: GPUs,
  storage: STORAGE,
  psu: PSUs,
  case: CASES,
  caseFan: CASE_FANS
};