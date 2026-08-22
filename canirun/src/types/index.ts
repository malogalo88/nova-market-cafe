export interface CPU {
  id: string;
  name: string;
  brand: "Intel" | "AMD";
  series: string;
  generation: string;
  cores: number;
  threads: number;
  baseClock: number;
  boostClock: number;
  tdp: number;
  integratedGraphics: string | null;
  socket: string;
  performanceScore: number;
  year: number;
}

export interface GPU {
  id: string;
  name: string;
  brand: "NVIDIA" | "AMD" | "Intel";
  series: string;
  vram: number;
  vramType: string;
  tdp: number;
  isLaptop: boolean;
  laptopSuffix: string | null;
  performanceScore: number;
  year: number;
}

export interface RAM {
  id: string;
  capacity: number;
  speed: number;
  type: string;
}

export interface Laptop {
  id: string;
  name: string;
  brand: string;
  cpuId: string;
  gpuId: string;
  ramCapacity: number;
  ramSpeed: number;
  displayResolution: string;
  displaySize: number;
  storageType: string;
  storageCapacity: number;
  year: number;
}

export interface Game {
  id: string;
  title: string;
  genre: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  engine: string;
  minRequirements: GameRequirements;
  recRequirements: GameRequirements;
  tags: string[];
}

export interface GameRequirements {
  cpuId: string;
  gpuId: string;
  ramGB: number;
  storageGB: number;
  os: string;
  directX: string | null;
  notes: string | null;
}

export interface SavedProfile {
  id: string;
  name: string;
  type: "desktop" | "laptop";
  cpuId: string;
  gpuId: string;
  ramGB: number;
  ramSpeed: number;
  storageType: string;
  storageCapacity: number;
  displayResolution: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisHistoryEntry {
  id: string;
  profileId: string;
  profileName: string;
  gameId: string;
  gameTitle: string;
  results: FpsEstimateResult;
  createdAt: string;
}

export interface FpsQualitySet {
  veryLow: number;
  low: number;
  medium: number;
  high: number;
  ultra: number;
  rayTracingLow: number;
  rayTracingMedium: number;
  rayTracingHigh: number;
  dlssUltra: number;
  dlssQuality: number;
  fsrUltra: number;
  fsrQuality: number;
  low1Percent: number;
}

export interface FpsEstimateResult {
  resolution720p: FpsQualitySet;
  resolution900p: FpsQualitySet;
  resolution1080p: FpsQualitySet;
  resolution1440p: FpsQualitySet;
  resolution4k: FpsQualitySet;
  meetsMinRequirements: boolean;
  meetsRecRequirements: boolean;
  bottleneckAnalysis: BottleneckResult;
  recommendedSettings: RecommendedSettings;
  upgradeSuggestions: UpgradeSuggestion[];
  performanceTier: PerformanceTier;
}

export interface BottleneckResult {
  cpuScore: number;
  gpuScore: number;
  ramScore: number;
  bottleneckPercent: number;
  bottleneckComponent: "CPU" | "GPU" | "RAM" | "Balanced";
  description: string;
}

export interface RecommendedSettings {
  resolution: string;
  quality: string;
  estimatedFps: number;
  description: string;
}

export type PerformanceTier = "excellent" | "good" | "playable" | "poor" | "not_recommended";

export interface UpgradeSuggestion {
  component: "CPU" | "GPU" | "RAM" | "Storage";
  current: string;
  recommended: string;
  reason: string;
  impact: "high" | "medium" | "low";
}

export interface CompareEntry {
  profile: SavedProfile;
  cpu: CPU;
  gpu: GPU;
  fpsEstimate?: FpsEstimateResult;
  gameId?: string;
}

export interface HardwareSearchFilters {
  query: string;
  brand?: string;
  type?: "cpu" | "gpu" | "laptop";
  minScore?: number;
  maxScore?: number;
  isLaptop?: boolean;
}

export interface GameSearchFilters {
  query: string;
  genre?: string;
  tags?: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
}

export interface UserPC {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  cpuId: string;
  cpuManufacturer: string;
  cpuModel: string;
  cpuGeneration: string;
  cpuCores: number;
  cpuThreads: number;
  cpuBaseClock: number;
  cpuBoostClock: number;
  cpuArchitecture: string;
  gpuId: string;
  gpuManufacturer: string;
  gpuModel: string;
  gpuIntegrated: boolean;
  gpuVram: number;
  gpuVramType: string;
  gpuArchitecture: string;
  gpuDirectX: string;
  ramTotalGB: number;
  ramType: string;
  ramSpeed: number;
  ramSticks: number;
  ramChannels: string;
  storageType: string;
  storageCapacityGB: number;
  storageFreeGB: number;
  displayResolution: string;
  displayRefreshRate: number;
  displayAspectRatio: string;
  osVersion: string;
  osArch: string;
  systemType: "desktop" | "laptop";
  laptopBrand: string;
  laptopModel: string;
  batteryInfo: string;
  createdAt: string;
  updatedAt: string;
}

export interface Favorite {
  id: string;
  userId: string;
  gameId: string;
  createdAt: string;
}
