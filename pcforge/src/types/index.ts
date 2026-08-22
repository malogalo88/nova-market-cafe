export type ComponentCategory = 
  | 'cpu' 
  | 'cpuCooler' 
  | 'motherboard' 
  | 'ram' 
  | 'gpu' 
  | 'storage' 
  | 'psu' 
  | 'case' 
  | 'caseFan';

export type SocketType = 
  | 'LGA1700' 
  | 'LGA1200' 
  | 'AM5' 
  | 'AM4' 
  | 'LGA1851'
  | 'TR5'
  | 'sTRX4';

export type RamType = 'DDR4' | 'DDR5';
export type PcieVersion = '3.0' | '4.0' | '5.0';
export type FormFactor = 'ATX' | 'Micro-ATX' | 'Mini-ITX' | 'E-ATX';
export type CaseSize = 'Full Tower' | 'Mid Tower' | 'Mini Tower' | 'SFF';

export interface ComponentSpecs {
  // CPU
  socket?: SocketType;
  cores?: number;
  threads?: number;
  baseClock?: number;
  boostClock?: number;
  tdp?: number;
  integratedGraphics?: boolean;
  
  // CPU Cooler
  coolerType?: 'air' | 'aio' | 'liquid';
  maxCoolerHeight?: number;
  supportedSockets?: SocketType[];
  
  // Motherboard
  chipset?: string;
  formFactor?: FormFactor;
  ramType?: RamType;
  maxRamCapacity?: number;
  ramSlots?: number;
  pcieVersion?: PcieVersion;
  m2Slots?: number;
  sataPorts?: number;
  cpuPowerPhases?: number;
  
  // RAM
  ramCapacity?: number;
  ramSpeed?: number;
  ramModules?: number;
  latency?: string;
  voltage?: number;
  
  // GPU
  vram?: number;
  vramType?: 'GDDR6' | 'GDDR6X' | 'HBM2';
  gpuLength?: number;
  gpuSlots?: number;
  gpuTdp?: number;
  powerConnectors?: string[];
  recommendedPsu?: number;
  
  // Storage
  storageType?: 'NVMe' | 'SATA' | 'HDD';
  storageCapacity?: number;
  storageInterface?: 'PCIe 3.0' | 'PCIe 4.0' | 'PCIe 5.0' | 'SATA III';
  readSpeed?: number;
  writeSpeed?: number;
  storageFormFactor?: 'M.2 2280' | 'M.2 2230' | '2.5"' | '3.5"';
  
  // PSU
  wattage?: number;
  efficiency?: '80+ Bronze' | '80+ Silver' | '80+ Gold' | '80+ Platinum' | '80+ Titanium';
  modular?: 'non-modular' | 'semi-modular' | 'full-modular';
  pcieCables?: number;
  cpuCables?: number;
  sataCables?: number;
  
  // Case
  supportedFormFactors?: FormFactor[];
  maxGpuLength?: number;
  maxCpuCoolerHeight?: number;
  maxPsuLength?: number;
  fanMounts?: { size: number; count: number }[];
  radiatorSupport?: { size: number; position: string }[];
  driveBays?: { '2.5"': number; '3.5"': number };
  
  // Case Fan
  fanSize?: number;
  fanRpm?: number;
  airflow?: number;
  staticPressure?: number;
  noiseLevel?: number;
  pwm?: boolean;
}

export interface Component {
  id: string;
  name: string;
  brand: string;
  category: ComponentCategory;
  price: number;
  image: string;
  specs: ComponentSpecs;
  performanceScore?: number; // 0-100
  gamingPerformance?: Record<string, number>; // game -> fps at 1080p high
  releaseYear?: number;
  description?: string;
}

export interface Build {
  id: string;
  name: string;
  components: Partial<Record<ComponentCategory, Component>>;
  totalPrice: number;
  budget?: number;
  compatibilityStatus: 'compatible' | 'warning' | 'incompatible';
  compatibilityIssues: CompatibilityIssue[];
  performanceScore: number;
  valueScore: number;
  compatibilityScore: number;
  upgradeabilityScore: number;
  overallScore: number;
  gamingPerformance: GamingPerformance;
  bottleneckAnalysis: BottleneckAnalysis;
  recommendations: Recommendation[];
  createdAt: number;
  updatedAt: number;
}

export interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  component: ComponentCategory;
  message: string;
  details?: string;
}

export interface GamingPerformance {
  resolution: '1080p' | '1440p' | '4K';
  quality: 'Low' | 'Medium' | 'High' | 'Ultra';
  estimates: Record<string, { min: number; max: number }>;
}

export interface BottleneckAnalysis {
  cpu: ComponentRating;
  gpu: ComponentRating;
  ram: ComponentRating;
  storage: ComponentRating;
  psu: ComponentRating;
  overall: string;
  weakestLink: ComponentCategory | null;
}

export type ComponentRating = 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Poor';

export interface Recommendation {
  type: 'upgrade' | 'save' | 'balance' | 'performance' | 'compatibility';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  component?: ComponentCategory;
  suggestedComponent?: Component;
  savings?: number;
  performanceGain?: string;
}

export interface FilterOptions {
  category?: ComponentCategory;
  minPrice?: number;
  maxPrice?: number;
  brand?: string[];
  socket?: SocketType;
  ramType?: RamType;
  formFactor?: FormFactor;
  minVram?: number;
  minWattage?: number;
  caseSize?: CaseSize;
  searchQuery?: string;
}

export interface BuildSummary {
  cpu: string;
  gpu: string;
  motherboard: string;
  ram: string;
  storage: string;
  psu: string;
  case: string;
  cpuCooler: string;
  caseFans: string;
  totalPrice: number;
  compatibilityStatus: string;
}