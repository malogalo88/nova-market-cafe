import { 
  Component, 
  ComponentCategory, 
  Build,
  GamingPerformance,
  BottleneckAnalysis,
  ComponentRating,
  allComponents
} from '../types/index';

/**
 * Gaming Performance Engine - Estimates FPS for games based on selected components
 */

const GAME_PRESET_FPS: Record<string, { min: number; max: number }> = {
  'Minecraft': { min: 100, max: 300 },
  'Fortnite': { min: 100, max: 180 },
  'Valorant': { min: 140, max: 250 },
  'GTA V': { min: 60, max: 120 },
  'CS2': { min: 150, max: 300 },
  'Cyberpunk 2077': { min: 45, max: 80 },
  'Apex Legends': { min: 80, max: 150 },
  'Call of Duty Warzone': { min: 60, max: 120 },
  'League of Legends': { min: 100, max: 200 }
};

/**
 * Estimate gaming performance based on selected components
 */
export function estimateGamingPerformance(
  build: Build,
  resolution: '1080p' | '1440p' | '4K',
  quality: 'Low' | 'Medium' | 'High' | 'Ultra'
): GamingPerformance {
  // Start with base estimates
  let estimatedFPS: Record<string, { min: number; max: number }> = {};
  
  for (const [game, fpsRange] of Object.entries(GAME_PRESET_FPS)) {
    let minFPS = fpsRange.min;
    let maxFPS = fpsRange.max;
    
    // GPU impact (most important for gaming)
    const gpu = build.components.gpu;
    if (gpu) {
      const gpuTier = gpu.performanceScore || 50;
      const qualityFactor = getQualityFactor(quality);
      const resolutionFactor = getResolutionFactor(resolution);
      const tierFactor = gpuTier / 50;
      
      // GPU determines performance at higher settings/resolutions
      const gpuModifier = resolutionFactor * qualityFactor * Math.max(0.5, Math.min(2.0, tierFactor / 50));
      minFPS = Math.floor(minFPS * gpuModifier);
      maxFPS = Math.floor(maxFPS * gpuModifier);
    }
    
    // CPU impact (important for CPU-heavy games and lower resolutions)
    const cpu = build.components.cpu;
    if (cpu) {
      const cpuTier = cpu.performanceScore || 50;
      const cpuModifier = 1 + ((cpuTier - 50) * 0.1);
      minFPS = Math.ceil(minFPS * cpuModifier);
      maxFPS = Math.ceil(maxFPS * cpuModifier);
    }
    
    // RAM impact
    const ram = build.components.ram;
    if (ram) {
      const ramCapacity = ram.specs.ramCapacity || 16;
      const ramModifier = calculateRamModifier(ramCapacity);
      minFPS = Math.ceil(minFPS * ramModifier);
      maxFPS = Math.ceil(maxFPS * ramModifier);
    }
    
    // Ensure minimum FPS doesn't drop too low
    minFPS = Math.max(minFPS, 20);
    maxFPS = Math.max(maxFPS, 30);
    
    estimatedFPS[game] = { min: minFPS, max: maxFPS };
  }
  
  return {
    resolution,
    quality,
    estimates: estimatedFPS
  };
}

/**
 * Get quality factor based on graphics settings
 */
function getQualityFactor(quality: 'Low' | 'Medium' | 'High' | 'Ultra'): number {
  const factors: Record<'Low' | 'Medium' | 'High' | 'Ultra', number> = {
    Low: 1.2,
    Medium: 1.0,
    High: 0.8,
    Ultra: 0.6
  };
  return factors[quality];
}

/**
 * Get resolution factor
 */
function getResolutionFactor(resolution: '1080p' | '1440p' | '4K'): number {
  const factors: Record<'1080p' | '1440p' | '4K', number> = {
    '1080p': 1.0,
    '1440p': 0.85,
    '4K': 0.7
  };
  return factors[resolution];
}

/**
 * Calculate RAM modifier based on capacity
 */
function calculateRamModifier(capacity: number): number {
  if (capacity >= 32) return 1.05;
  if (capacity >= 16) return 1.0;
  if (capacity >= 8) return 0.95;
  return 0.9; // 4GB or less
}

/**
 * Analyze bottlenecks in a build
 */
export function analyzeBottleneck(build: Build): BottleneckAnalysis {
  const ratings: {
    cpu: ComponentRating;
    gpu: ComponentRating;
    ram: ComponentRating;
    storage: ComponentRating;
    psu: ComponentRating;
  } = {
    cpu: 'Good',
    gpu: 'Good',
    ram: 'Good',
    storage: 'Good',
    psu: 'Good'
  };
  
  let totalScore = 0;
  let componentCount = 0;
  
  // Analyze CPU
  if (build.components.cpu) {
    const cpuScore = build.components.cpu.performanceScore || 50;
    totalScore += cpuScore;
    componentCount++;
    ratings.cpu = rateComponent(cpuScore);
  }
  
  // Analyze GPU
  if (build.components.gpu) {
    const gpuScore = build.components.gpu.performanceScore || 50;
    totalScore += gpuScore;
    componentCount++;
    ratings.gpu = rateComponent(gpuScore);
  }
  
  // Analyze RAM
  if (build.components.ram) {
    const ramCapacity = build.components.ram.specs.ramCapacity || 16;
    totalScore += ramCapacity;
    componentCount++;
    ratings.ram = rateRAM(ramCapacity);
  }
  
  // Analyze Storage
  if (build.components.storage) {
    const storageSpeed = build.components.storage.specs.readSpeed || 3500;
    totalScore += storageSpeed;
    componentCount++;
    ratings.storage = rateStorage(storageSpeed);
  }
  
  // Analyze PSU
  if (build.components.psu) {
    const psuWattage = build.components.psu.specs.wattage || 600;
    totalScore += psuWattage;
    componentCount++;
    ratings.psu = ratePSU(psuWattage);
  }
  
  const averageScore = componentCount > 0 ? totalScore / componentCount : 50;
  
  // Determine weakest link
  const ratingValues: Record<ComponentRating, number> = {
    'Excellent': 100,
    'Very Good': 80,
    'Good': 60,
    'Fair': 40,
    'Poor': 20
  };
  
  const ratingScores: number[] = Object.values(ratings).map(r => ratingValues[r]);
  const minScore = Math.min(...ratingScores);
  const weakestLinkKey = Object.keys(ratingValues).find(
    key => ratingValues[key as keyof typeof ratingValues] === minScore
  );
  const weakestLink = weakestLinkKey as ComponentCategory | null;
  
  let overall: string;
  if (averageScore >= 80) {
    overall = 'Strong';
  } else if (averageScore >= 60) {
    overall = 'Balanced';
  } else {
    overall = 'Needs Improvement';
  }
  
  return {
    cpu: ratings.cpu,
    gpu: ratings.gpu,
    ram: ratings.ram,
    storage: ratings.storage,
    psu: ratings.psu,
    overall,
    weakestLink
  };
}

/**
 * Rate component based on score (0-100)
 */
function rateComponent(score: number): ComponentRating {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Very Good';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Fair';
  return 'Poor';
}

/**
 * Rate RAM based on capacity
 */
function rateRAM(capacity: number): ComponentRating {
  if (capacity >= 32) return 'Excellent';
  if (capacity >= 16) return 'Very Good';
  if (capacity >= 8) return 'Good';
  return 'Fair';
}

/**
 * Rate storage based on speed
 */
function rateStorage(speed: number): ComponentRating {
  if (speed >= 7000) return 'Excellent';
  if (speed >= 5000) return 'Very Good';
  if (speed >= 3500) return 'Good';
  if (speed >= 2000) return 'Fair';
  return 'Poor';
}

/**
 * Rate PSU based on wattage and efficiency
 */
function ratePSU(wattage: number): ComponentRating {
  if (wattage >= 850) return 'Excellent';
  if (wattage >= 750) return 'Very Good';
  if (wattage >= 650) return 'Good';
  if (wattage >= 500) return 'Fair';
  return 'Poor';
}

/**
 * Get game FPS estimate
 */
export function getGameFPSEstimate(
  build: Build,
  game: string,
  resolution: '1080p' | '1440p' | '4K',
  quality: 'Low' | 'Medium' | 'High' | 'Ultra'
): { min: number; max: number } | null {
  const performance = estimateGamingPerformance(build, resolution, quality);
  return performance.estimates[game] || null;
}

// Export all functions
export { 
  estimateGamingPerformance, 
  analyzeBottleneck, 
  getGameFPSEstimate,
  BottleneckAnalysis,
  GamingPerformance
};