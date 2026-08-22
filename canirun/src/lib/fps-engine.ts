import { getDb } from "./db";
import type {
  CPU,
  GPU,
  Game,
  FpsEstimateResult,
  FpsQualitySet,
  BottleneckResult,
  RecommendedSettings,
  UpgradeSuggestion,
  PerformanceTier,
  SavedProfile,
} from "@/types";

function getCpuById(id: string): CPU | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM cpus WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return {
    ...row,
    integratedGraphics: (row.integratedGraphics as string) || null,
  } as unknown as CPU;
}

function getGpuById(id: string): GPU | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM gpus WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return {
    ...row,
    isLaptop: Boolean(row.isLaptop),
    laptopSuffix: (row.laptopSuffix as string) || null,
  } as unknown as GPU;
}

function getGameById(id: string): Game | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM games WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return {
    id: row.id as string,
    title: row.title as string,
    genre: row.genre as string,
    developer: row.developer as string,
    publisher: row.publisher as string,
    releaseDate: row.releaseDate as string,
    engine: row.engine as string,
    minRequirements: {
      cpuId: row.minCpuId as string,
      gpuId: row.minGpuId as string,
      ramGB: row.minRamGB as number,
      storageGB: row.minStorageGB as number,
      os: row.minOs as string,
      directX: (row.minDirectX as string) || null,
      notes: (row.minNotes as string) || null,
    },
    recRequirements: {
      cpuId: row.recCpuId as string,
      gpuId: row.recGpuId as string,
      ramGB: row.recRamGB as number,
      storageGB: row.recStorageGB as number,
      os: row.recOs as string,
      directX: (row.recDirectX as string) || null,
      notes: (row.recNotes as string) || null,
    },
    tags: JSON.parse((row.tags as string) || "[]"),
  };
}

function getRamMultiplier(ramGB: number): number {
  if (ramGB <= 4) return 0.6;
  if (ramGB <= 6) return 0.7;
  if (ramGB <= 8) return 0.8;
  if (ramGB <= 12) return 0.9;
  if (ramGB <= 16) return 1.0;
  if (ramGB <= 24) return 1.05;
  if (ramGB <= 32) return 1.08;
  return 1.1;
}

function getResolutionMultiplier(resolution: string): number {
  switch (resolution) {
    case "720p":
      return 1.6;
    case "900p":
      return 1.3;
    case "1080p":
      return 1.0;
    case "1440p":
      return 0.65;
    case "4k":
      return 0.35;
    default:
      return 1.0;
  }
}

function getQualityMultiplier(quality: string): number {
  switch (quality) {
    case "veryLow":
      return 1.5;
    case "low":
      return 1.3;
    case "medium":
      return 1.0;
    case "high":
      return 0.75;
    case "ultra":
      return 0.55;
    default:
      return 1.0;
  }
}

function calculateBaseFps(
  cpuScore: number,
  gpuScore: number,
  ramGB: number
): number {
  const ramMultiplier = getRamMultiplier(ramGB);
  const combinedScore =
    gpuScore * 0.7 + cpuScore * 0.2 + 100 * ramMultiplier * 0.1;
  const baseFps = combinedScore * 1.4;
  return Math.max(1, Math.round(baseFps));
}

function calculateGameFps(
  cpuScore: number,
  gpuScore: number,
  ramGB: number,
  game: Game,
  resolution: string,
  quality: string
): number {
  const db = getDb();

  const minCpu = db
    .prepare("SELECT performanceScore FROM cpus WHERE id = ?")
    .get(game.minRequirements.cpuId) as
    | { performanceScore: number }
    | undefined;
  const minGpu = db
    .prepare("SELECT performanceScore FROM gpus WHERE id = ?")
    .get(game.minRequirements.gpuId) as
    | { performanceScore: number }
    | undefined;

  if (!minCpu || !minGpu) {
    const baseFps = calculateBaseFps(cpuScore, gpuScore, ramGB);
    const resMult = getResolutionMultiplier(resolution);
    const qualMult = getQualityMultiplier(quality);
    return Math.max(1, Math.round(baseFps * resMult * qualMult));
  }

  const minCombined =
    minGpu.performanceScore * 0.7 + minCpu.performanceScore * 0.2;
  const minRamMult = getRamMultiplier(game.minRequirements.ramGB);
  const minScore = minCombined + 100 * minRamMult * 0.1;
  const minBaseFpsAtMedium1080 = 30;

  const userRamMult = getRamMultiplier(ramGB);
  const userCombined = gpuScore * 0.7 + cpuScore * 0.2 + 100 * userRamMult * 0.1;
  const relativePerformance = minScore > 0 ? userCombined / minScore : 1;

  const recCpu = db
    .prepare("SELECT performanceScore FROM cpus WHERE id = ?")
    .get(game.recRequirements.cpuId) as
    | { performanceScore: number }
    | undefined;
  const recGpu = db
    .prepare("SELECT performanceScore FROM gpus WHERE id = ?")
    .get(game.recRequirements.gpuId) as
    | { performanceScore: number }
    | undefined;

  let targetFps = minBaseFpsAtMedium1080 * relativePerformance;
  if (recCpu && recGpu) {
    const recCombined =
      recGpu.performanceScore * 0.7 + recCpu.performanceScore * 0.2;
    const recRamMult = getRamMultiplier(game.recRequirements.ramGB);
    const recScore = recCombined + 100 * recRamMult * 0.1;
    const recRelative = recScore > 0 ? userCombined / recScore : 1;
    const recBaseFpsAtMedium1080 = 65;
    const recBasedFps = recBaseFpsAtMedium1080 * recRelative;
    targetFps = targetFps * 0.4 + recBasedFps * 0.6;
  }

  const resMult = getResolutionMultiplier(resolution);
  const qualMult = getQualityMultiplier(quality);
  const rawFps = targetFps * resMult * qualMult;

  return Math.max(1, Math.round(rawFps));
}

function buildFpsQualitySet(
  cpuScore: number,
  gpuScore: number,
  ramGB: number,
  game: Game,
  resolution: string
): FpsQualitySet {
  const veryLow = calculateGameFps(cpuScore, gpuScore, ramGB, game, resolution, "veryLow");
  const low = calculateGameFps(cpuScore, gpuScore, ramGB, game, resolution, "low");
  const medium = calculateGameFps(cpuScore, gpuScore, ramGB, game, resolution, "medium");
  const high = calculateGameFps(cpuScore, gpuScore, ramGB, game, resolution, "high");
  const ultra = calculateGameFps(cpuScore, gpuScore, ramGB, game, resolution, "ultra");

  const rtLowMult = 0.85;
  const rtMedMult = 0.7;
  const rtHighMult = 0.55;
  const dlssQualityMult = 1.25;
  const dlssUltraMult = 1.4;
  const fsrQualityMult = 1.2;
  const fsrUltraMult = 1.35;

  const rayTracingLow = Math.max(1, Math.round(medium * rtLowMult));
  const rayTracingMedium = Math.max(1, Math.round(medium * rtMedMult));
  const rayTracingHigh = Math.max(1, Math.round(medium * rtHighMult));
  const dlssQuality = Math.max(1, Math.round(high * dlssQualityMult));
  const dlssUltra = Math.max(1, Math.round(high * dlssUltraMult));
  const fsrQuality = Math.max(1, Math.round(high * fsrQualityMult));
  const fsrUltra = Math.max(1, Math.round(high * fsrUltraMult));
  const low1Percent = Math.max(1, Math.round(medium * 0.7));

  return {
    veryLow,
    low,
    medium,
    high,
    ultra,
    rayTracingLow,
    rayTracingMedium,
    rayTracingHigh,
    dlssUltra,
    dlssQuality,
    fsrUltra,
    fsrQuality,
    low1Percent,
  };
}

function getPerformanceTier(avgFps: number): PerformanceTier {
  if (avgFps >= 90) return "excellent";
  if (avgFps >= 60) return "good";
  if (avgFps >= 45) return "playable";
  if (avgFps >= 30) return "poor";
  return "not_recommended";
}

function buildUpgradeSuggestions(
  cpuScore: number,
  gpuScore: number,
  ramGB: number,
  game: Game
): UpgradeSuggestion[] {
  const db = getDb();
  const suggestions: UpgradeSuggestion[] = [];

  const minCpu = db
    .prepare("SELECT performanceScore, name FROM cpus WHERE id = ?")
    .get(game.minRequirements.cpuId) as { performanceScore: number; name: string } | undefined;
  const recCpu = db
    .prepare("SELECT performanceScore, name FROM cpus WHERE id = ?")
    .get(game.recRequirements.cpuId) as { performanceScore: number; name: string } | undefined;

  const minGpu = db
    .prepare("SELECT performanceScore, name FROM gpus WHERE id = ?")
    .get(game.minRequirements.gpuId) as { performanceScore: number; name: string } | undefined;
  const recGpu = db
    .prepare("SELECT performanceScore, name FROM gpus WHERE id = ?")
    .get(game.recRequirements.gpuId) as { performanceScore: number; name: string } | undefined;

  if (minCpu && cpuScore < minCpu.performanceScore) {
    const target = recCpu || minCpu;
    suggestions.push({
      component: "CPU",
      current: `Score: ${cpuScore}`,
      recommended: target.name,
      reason: "Your CPU is below the game's minimum requirements.",
      impact: "high",
    });
  } else if (recCpu && cpuScore < recCpu.performanceScore) {
    suggestions.push({
      component: "CPU",
      current: `Score: ${cpuScore}`,
      recommended: recCpu.name,
      reason: "Upgrading CPU would improve frame rates and reduce stuttering.",
      impact: "medium",
    });
  }

  if (minGpu && gpuScore < minGpu.performanceScore) {
    const target = recGpu || minGpu;
    suggestions.push({
      component: "GPU",
      current: `Score: ${gpuScore}`,
      recommended: target.name,
      reason: "Your GPU is below the game's minimum requirements.",
      impact: "high",
    });
  } else if (recGpu && gpuScore < recGpu.performanceScore) {
    suggestions.push({
      component: "GPU",
      current: `Score: ${gpuScore}`,
      recommended: recGpu.name,
      reason: "A better GPU would allow higher quality settings and resolutions.",
      impact: "high",
    });
  }

  if (ramGB < game.minRequirements.ramGB) {
    suggestions.push({
      component: "RAM",
      current: `${ramGB}GB`,
      recommended: `${game.recRequirements.ramGB}GB`,
      reason: "You need more RAM to meet the game's minimum requirements.",
      impact: "high",
    });
  } else if (ramGB < game.recRequirements.ramGB) {
    suggestions.push({
      component: "RAM",
      current: `${ramGB}GB`,
      recommended: `${game.recRequirements.ramGB}GB`,
      reason: "More RAM would improve performance in memory-intensive scenes.",
      impact: "medium",
    });
  }

  if (suggestions.length === 0) {
    const userStorage = 512;
    if (userStorage < game.minRequirements.storageGB) {
      suggestions.push({
        component: "Storage",
        current: `${userStorage}GB available`,
        recommended: `${game.minRequirements.storageGB}GB required`,
        reason: "You need more storage space to install this game.",
        impact: "high",
      });
    }
  }

  return suggestions;
}

export function estimateFps(
  cpuScore: number,
  gpuScore: number,
  ramGB: number,
  game: Game,
  resolution: string,
  quality: string
): number {
  return calculateGameFps(cpuScore, gpuScore, ramGB, game, resolution, quality);
}

export function analyzeBottleneck(
  cpuScore: number,
  gpuScore: number,
  ramGB: number
): BottleneckResult {
  const ramScore = Math.round(getRamMultiplier(ramGB) * 100);
  const scores = { CPU: cpuScore, GPU: gpuScore, RAM: ramScore };
  const maxScore = Math.max(cpuScore, gpuScore, ramScore);
  const minScore = Math.min(cpuScore, gpuScore, ramScore);

  const bottleneckPercent =
    maxScore > 0
      ? Math.round(((maxScore - minScore) / maxScore) * 100)
      : 0;

  let bottleneckComponent: BottleneckResult["bottleneckComponent"];
  let description: string;

  if (bottleneckPercent <= 5) {
    bottleneckComponent = "Balanced";
    description =
      "Your components are well-balanced. No single part significantly limits performance.";
  } else {
    const weakest = Object.entries(scores).reduce((a, b) =>
      a[1] < b[1] ? a : b
    );
    bottleneckComponent = weakest[0] as BottleneckResult["bottleneckComponent"];

    const weakestScore = weakest[1];
    const strongest = Object.entries(scores).reduce((a, b) =>
      a[1] > b[1] ? a : b
    );
    const deficit = Math.round(
      ((strongest[1] - weakestScore) / strongest[1]) * 100
    );

    switch (bottleneckComponent) {
      case "CPU":
        description =
          `Your CPU is the bottleneck, limiting performance by ~${deficit}%. ` +
          `Upgrading to a faster CPU would provide the most benefit.`;
        break;
      case "GPU":
        description =
          `Your GPU is the bottleneck, limiting performance by ~${deficit}%. ` +
          `A more powerful GPU would yield the biggest improvement.`;
        break;
      case "RAM":
        description =
          `Your RAM is the bottleneck, limiting performance by ~${deficit}%. ` +
          `Adding more RAM would help, especially in memory-heavy games.`;
        break;
      default:
        description = "Performance is limited by the weakest component.";
    }
  }

  return {
    cpuScore,
    gpuScore,
    ramScore,
    bottleneckPercent,
    bottleneckComponent,
    description,
  };
}

export function getRecommendedSettings(
  cpuScore: number,
  gpuScore: number,
  ramGB: number,
  game: Game
): RecommendedSettings {
  const resolutions = ["1080p", "1440p", "4k"];
  const qualities = ["low", "medium", "high", "ultra"];

  let bestMatch: { resolution: string; quality: string; fps: number } | null =
    null;

  for (const res of resolutions) {
    for (const qual of qualities) {
      const fps = calculateGameFps(cpuScore, gpuScore, ramGB, game, res, qual);
      if (fps >= 50 && fps <= 70) {
        if (!bestMatch || fps >= 55) {
          bestMatch = { resolution: res, quality: qual, fps };
        }
      }
    }
  }

  if (!bestMatch) {
    bestMatch = { resolution: "1080p", quality: "medium", fps: 0 };
    for (const res of resolutions) {
      for (const qual of qualities) {
        const fps = calculateGameFps(
          cpuScore,
          gpuScore,
          ramGB,
          game,
          res,
          qual
        );
        if (fps >= 30 && fps <= 80) {
          if (
            !bestMatch.fps ||
            (fps >= 50 && fps < bestMatch.fps) ||
            (bestMatch.fps < 30)
          ) {
            bestMatch = { resolution: res, quality: qual, fps };
          }
        }
      }
    }
    if (!bestMatch.fps) {
      const fps = calculateGameFps(cpuScore, gpuScore, ramGB, game, "1080p", "low");
      bestMatch = { resolution: "1080p", quality: "low", fps };
    }
  }

  const fpsLabel =
    bestMatch.fps >= 90
      ? "excellent"
      : bestMatch.fps >= 60
        ? "smooth"
        : bestMatch.fps >= 30
          ? "playable"
          : "below target";

  const description =
    `${bestMatch.resolution} at ${bestMatch.quality} quality for ` +
    `an estimated ~${bestMatch.fps} FPS (${fpsLabel} performance) ` +
    `in ${game.title}.`;

  return {
    resolution: bestMatch.resolution,
    quality: bestMatch.quality,
    estimatedFps: bestMatch.fps,
    description,
  };
}

export function checkRequirements(
  cpuId: string,
  gpuId: string,
  ramGB: number,
  game: Game
): { meetsMin: boolean; meetsRec: boolean } {
  const db = getDb();

  const cpu = db
    .prepare("SELECT performanceScore FROM cpus WHERE id = ?")
    .get(cpuId) as { performanceScore: number } | undefined;
  const gpu = db
    .prepare("SELECT performanceScore FROM gpus WHERE id = ?")
    .get(gpuId) as { performanceScore: number } | undefined;

  const minCpu = db
    .prepare("SELECT performanceScore FROM cpus WHERE id = ?")
    .get(game.minRequirements.cpuId) as
    | { performanceScore: number }
    | undefined;
  const minGpu = db
    .prepare("SELECT performanceScore FROM gpus WHERE id = ?")
    .get(game.minRequirements.gpuId) as
    | { performanceScore: number }
    | undefined;

  const recCpu = db
    .prepare("SELECT performanceScore FROM cpus WHERE id = ?")
    .get(game.recRequirements.cpuId) as
    | { performanceScore: number }
    | undefined;
  const recGpu = db
    .prepare("SELECT performanceScore FROM gpus WHERE id = ?")
    .get(game.recRequirements.gpuId) as
    | { performanceScore: number }
    | undefined;

  let meetsMin = true;
  if (cpu && minCpu && cpu.performanceScore < minCpu.performanceScore)
    meetsMin = false;
  if (gpu && minGpu && gpu.performanceScore < minGpu.performanceScore)
    meetsMin = false;
  if (ramGB < game.minRequirements.ramGB) meetsMin = false;

  let meetsRec = true;
  if (cpu && recCpu && cpu.performanceScore < recCpu.performanceScore)
    meetsRec = false;
  if (gpu && recGpu && gpu.performanceScore < recGpu.performanceScore)
    meetsRec = false;
  if (ramGB < game.recRequirements.ramGB) meetsRec = false;

  return { meetsMin, meetsRec };
}

export function runFullEstimate(
  profile: SavedProfile,
  gameId: string
): FpsEstimateResult {
  const cpu = getCpuById(profile.cpuId);
  const gpu = getGpuById(profile.gpuId);
  const game = getGameById(gameId);

  if (!cpu || !gpu || !game) {
    throw new Error(
      `Missing data: CPU=${profile.cpuId}, GPU=${profile.gpuId}, Game=${gameId}`
    );
  }

  const resolutions = ["720p", "900p", "1080p", "1440p", "4k"] as const;

  const result = {
    resolution720p: {} as FpsQualitySet,
    resolution900p: {} as FpsQualitySet,
    resolution1080p: {} as FpsQualitySet,
    resolution1440p: {} as FpsQualitySet,
    resolution4k: {} as FpsQualitySet,
  } as FpsEstimateResult;

  for (const res of resolutions) {
    const resKey =
      res === "720p"
        ? "resolution720p"
        : res === "900p"
          ? "resolution900p"
          : res === "1080p"
            ? "resolution1080p"
            : res === "1440p"
              ? "resolution1440p"
              : "resolution4k";

    (result as unknown as Record<string, FpsQualitySet>)[resKey] = buildFpsQualitySet(
      cpu.performanceScore,
      gpu.performanceScore,
      profile.ramGB,
      game,
      res
    );
  }

  const requirements = checkRequirements(
    profile.cpuId,
    profile.gpuId,
    profile.ramGB,
    game
  );

  result.meetsMinRequirements = requirements.meetsMin;
  result.meetsRecRequirements = requirements.meetsRec;
  result.bottleneckAnalysis = analyzeBottleneck(
    cpu.performanceScore,
    gpu.performanceScore,
    profile.ramGB
  );
  result.recommendedSettings = getRecommendedSettings(
    cpu.performanceScore,
    gpu.performanceScore,
    profile.ramGB,
    game
  );

  const avgFps1080 =
    (result.resolution1080p.low +
      result.resolution1080p.medium +
      result.resolution1080p.high) /
    3;
  result.performanceTier = getPerformanceTier(avgFps1080);

  result.upgradeSuggestions = buildUpgradeSuggestions(
    cpu.performanceScore,
    gpu.performanceScore,
    profile.ramGB,
    game
  );

  return result;
}
