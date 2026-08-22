import { create } from 'zustand';
import { 
  Component, 
  ComponentCategory, 
  Build, 
  CompatibilityIssue,
  FilterOptions,
  Recommendation,
  GamingPerformance,
  BottleneckAnalysis
} from '../types/index';

import { allComponents } from '../data/components';

// Persistence helpers
const STORAGE_KEY = 'pcforge_builds';

const loadBuildsFromStorage = (): Build[] => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized === null) return [];
    const parsed = JSON.parse(serialized);
    // Convert date strings back to numbers
    return parsed.map((b: any) => ({
      ...b,
      createdAt: b.createdAt || Date.now(),
      updatedAt: b.updatedAt || Date.now()
    }));
  } catch (e) {
    console.error('Failed to load builds from storage', e);
    return [];
  }
};

const saveBuildsToStorage = (builds: Build[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
  } catch (e) {
    console.error('Failed to save builds to storage', e);
  }
};

// Initial builds from the database
const initialBuilds = loadBuildsFromStorage();

interface BuildState {
  // Current build being edited
  currentBuild: Build | null;
  // All saved builds
  savedBuilds: Build[];
  // Selected filters
  filters: FilterOptions;
  // Gaming performance settings
  resolution: '1080p' | '1440p' | '4K';
  quality: 'Low' | 'Medium' | 'High' | 'Ultra';
  
  // Actions
  setCurrentBuild: (build: Build | null) => void;
  addComponent: (category: ComponentCategory, component: Component) => void;
  removeComponent: (category: ComponentCategory) => void;
  setFilters: (filters: FilterOptions) => void;
  setResolution: (res: '1080p' | '1440p' | '4K') => void;
  setQuality: (qual: 'Low' | 'Medium' | 'High' | 'Ultra') => void;
  saveCurrentBuild: (name?: string) => Build | null;
  deleteBuild: (buildId: string) => void;
  selectComponent: (category: ComponentCategory, componentId: string) => Component | null;
  getCompatibilityStatus: () => { status: string; issues: CompatibilityIssue[]; score: number };
  getPriceSummary: () => { total: number; breakdown: Record<string, number> };
  getGamingPerformance: () => GamingPerformance;
  getBottleneckAnalysis: () => BottleneckAnalysis;
  getRecommendations: () => Recommendation[];
  addSavedBuild: (build: Build) => void;
}

export const useBuildStore = create<BuildState>((set, get) => ({
  // Initial state
  currentBuild: null,
  savedBuilds: initialBuilds,
  filters: {
    searchQuery: '',
  },
  resolution: '1080p',
  quality: 'High',
  
  // Set current build
  setCurrentBuild: (build: Build | null) => set({ currentBuild: build }),
  
  // Add component to build
  addComponent: (category: ComponentCategory, component: Component) => set((state) => {
    const current = state.currentBuild;
    if (!current) return state;
    
    const updatedComponents = {
      ...current.components,
      [category]: component
    };
    
    const updatedPrice = Object.values(updatedComponents)
      .filter((c): c is Component => c !== undefined)
      .reduce((sum, c) => sum + (c?.price || 0), 0);
    
    const updatedBuild: Build = {
      ...current,
      components: updatedComponents,
      totalPrice: updatedPrice,
      compatibilityStatus: 'checking',
      compatibilityIssues: [],
      overallScore: 0,
      createdAt: current.createdAt,
      updatedAt: Date.now()
    };
    
    // Check compatibility
    const compatibility = checkBuildCompatibility(updatedBuild as Build);
    const recommendations = generateRecommendations(updatedBuild as Build);
    const bottleneck = analyzeBottleneck(updatedBuild as Build);
    const gamingPerformance = estimateGamingPerformance(updatedBuild as Build, get().resolution, get().quality);
    
    return {
      ...state,
      currentBuild: {
        ...updatedBuild,
        compatibilityStatus: compatibility.status,
        compatibilityIssues: compatibility.issues,
        overallScore: compatibility.overallScore,
        recommendations,
        bottleneckAnalysis: bottleneck,
        gamingPerformance
      }
    };
  }),
  
  // Remove component from build
  removeComponent: (category: ComponentCategory) => set((state) => {
    const current = state.currentBuild;
    if (!current) return state;
    
    const { [category]: removed, ...remainingComponents } = current.components;
    
    const updatedPrice = Object.values(remainingComponents)
      .filter((c): c is Component => c !== undefined)
      .reduce((sum, c) => sum + (c?.price || 0), 0);
    
    const updatedBuild: Build = {
      ...current,
      components: remainingComponents,
      totalPrice: updatedPrice,
      compatibilityStatus: 'checking',
      compatibilityIssues: [],
      overallScore: 0,
      updatedAt: Date.now()
    };
    
    // Re-check compatibility if there are still components
    let newCompatibility = { status: 'compatible', issues: [], overallScore: 100 };
    let newRecommendations: Recommendation[] = [];
    let newBottleneck: BottleneckAnalysis = {
      cpu: 'Good', gpu: 'Good', ram: 'Good', storage: 'Good', psu: 'Good', overall: 'Balanced', weakestLink: null
    };
    
    if (Object.keys(remainingComponents).length > 0) {
      newCompatibility = checkBuildCompatibility(updatedBuild as unknown as Build);
      newRecommendations = generateRecommendations(updatedBuild as unknown as Build);
      newBottleneck = analyzeBottleneck(updatedBuild as unknown as Build);
    }
    
    const gamingPerformance = estimateGamingPerformance(
      updatedBuild as unknown as Build, 
      get().resolution, 
      get().quality
    );
    
    return {
      ...state,
      currentBuild: {
        ...updatedBuild,
        compatibilityStatus: newCompatibility.status,
        compatibilityIssues: newCompatibility.issues,
        overallScore: newCompatibility.overallScore,
        recommendations: newRecommendations,
        bottleneckAnalysis: newBottleneck,
        gamingPerformance
      }
    };
  }),
  
  // Update component in build
  updateComponent: (category: ComponentCategory, component: Component) => set(get().addComponent(category, component)),
  
  // Set filters
  setFilters: (filters: FilterOptions) => set({ filters }),
  
  // Set resolution
  setResolution: (res: '1080p' | '1440p' | '4K') => set({ resolution: res }),
  
  // Set quality
  setQuality: (qual: 'Low' | 'Medium' | 'High' | 'Ultra') => set({ quality: qual }),
  
  // Save current build
  saveCurrentBuild: (name?: string) => {
    const state = get();
    const current = state.currentBuild;
    if (!current) return null;
    
    const buildName = name || `Build ${Date.now()}`;
    const newBuild: Build = {
      ...current,
      id: `build-${Date.now()}`,
      name: buildName,
      updatedAt: Date.now(),
    };
    
    // Add to saved builds
    const updatedSavedBuilds = [...state.savedBuilds, newBuild];
    saveBuildsToStorage(updatedSavedBuilds);
    
    return newBuild;
  },
  
  // Delete build
  deleteBuild: (buildId: string) => set((state) => ({
    savedBuilds: state.savedBuilds.filter(build => build.id !== buildId),
    currentBuild: state.currentBuild?.id === buildId ? null : state.currentBuild
  })),
  
  // Select component (for dropdown or drag-and-drop)
  selectComponent: (category: ComponentCategory, componentId: string) => {
    const component = allComponents[category].find(c => c.id === componentId);
    if (!component) return null;
    return component;
  },
  
  // Get compatibility status
  getCompatibilityStatus: () => {
    const state = get();
    const current = state.currentBuild;
    if (!current) return { status: 'no build', issues: [], score: 100 };
    
    const compatibility = checkBuildCompatibility(current);
    return {
      status: compatibility.status,
      issues: compatibility.issues,
      score: compatibility.overallScore
    };
  },
  
  // Get price summary
  getPriceSummary: () => {
    const state = get();
    const current = state.currentBuild;
    if (!current) return { total: 0, breakdown: {} };
    
    const breakdown: Record<string, number> = {};
    let total = 0;
    
    for (const [category, component] of Object.entries(current.components)) {
      if (component) {
        const categoryName = category.replace(/([A-Z])/g, ' $1').trim();
        breakdown[categoryName] = component.price;
        total += component.price;
      }
    }
    
    return { total, breakdown };
  },
  
  // Get gaming performance
  getGamingPerformance: () => {
    const state = get();
    const current = state.currentBuild;
    if (!current) {
      return {
        resolution: '1080p',
        quality: 'High',
        estimates: {}
      };
    }
    
    return estimateGamingPerformance(current, state.resolution, state.quality);
  },
  
  // Get bottleneck analysis
  getBottleneckAnalysis: () => {
    const state = get();
    const current = state.currentBuild;
    if (!current) {
      return {
        cpu: 'Good', gpu: 'Good', ram: 'Good', storage: 'Good', psu: 'Good', overall: 'Balanced', weakestLink: null
      };
    }
    
    return analyzeBottleneck(current);
  },
  
  // Get recommendations
  getRecommendations: () => {
    const state = get();
    const current = state.currentBuild;
    if (!current) return [];
    
    return generateRecommendations(current);
  },
  
  // Initialize a new build
  initializeNewBuild: () => set({
    currentBuild: {
      id: 'build-new',
      name: 'New Build',
      components: {} as Record<ComponentCategory, Component | undefined>,
      totalPrice: 0,
      compatibilityStatus: 'pending',
      compatibilityIssues: [],
      overallScore: 0,
      gamingPerformance: {
        resolution: '1080p',
        quality: 'High',
        estimates: {}
      },
      bottleneckAnalysis: {
        cpu: 'Good', gpu: 'Good', ram: 'Good', storage: 'Good', psu: 'Good', overall: 'Balanced', weakestLink: null
      },
      recommendations: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  })
}));