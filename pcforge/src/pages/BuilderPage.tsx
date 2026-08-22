import { useState } from 'react';
import { ComponentCategory, Component } from './types/index';
import { CPUs, GPUs, RAM, STORAGE, PSUs, CASES, CPU_COOLERS, CASE_FANS, allComponents, MOTHERBOARDS } from './data';
import { BuilderLayout } from './components/ui/builderLayout';
import { ComponentCard } from './components/ui/ComponentCard';
import { CompatibilityStatus } from './components/ui/CompatibilityStatus';
import { PriceSummary } from './components/ui/PriceSummary';

export const BuilderPage = () => {
  const [currentBuild, setCurrentBuild] = useState(() => ({
    id: 'build-new',
    name: 'New Build',
    components: {} as Record<ComponentCategory, Component | undefined>,
    totalPrice: 0,
    compatibilityStatus: 'pending',
    compatibilityIssues: [],
    overallScore: 0,
  }));

  const categoryNames: Record<ComponentCategory, string> = {
    cpu: 'CPU',
    cpuCooler: 'Cooler',
    motherboard: 'Motherboard',
    ram: 'RAM',
    gpu: 'GPU',
    storage: 'Storage',
    psu: 'PSU',
    case: 'Case',
    caseFan: 'Fan',
  };

  const handleComponentClick = (component: Component) => {
    const category = component.category;
    const alreadyInBuild = currentBuild.components[category]?.id === component.id;
    
    if (alreadyInBuild) {
      // Remove component
      const newComponents = { ...currentBuild.components };
      delete newComponents[category];
      setCurrentBuild(prev => ({
        ...prev,
        components: newComponents,
        totalPrice: prev.totalPrice - component.price,
        compatibilityStatus: 'checking',
        compatibilityIssues: [],
        overallScore: 0,
      }));
    } else {
      // Add component
      const newComponents = { ...currentBuild.components, [category]: component };
      const newTotalPrice = currentBuild.totalPrice + component.price;
      
      setCurrentBuild(prev => ({
        ...prev,
        components: newComponents,
        totalPrice: newTotalPrice,
        compatibilityStatus: 'checking',
        compatibilityIssues: [],
        overallScore: 0,
      }));
    }
  };

  // Initialize with some default components if build is empty
  useState(() => {
    if (Object.keys(currentBuild.components).length === 0) {
      // Add a basic CPU
      const basicCpu = CPUs[0];
      if (basicCpu) {
        setCurrentBuild({
          id: 'build-new',
          name: 'New Build',
          components: { cpu: basicCpu },
          totalPrice: basicCpu.price,
          compatibilityStatus: 'checking',
          compatibilityIssues: [],
          overallScore: 0,
        });
      }
    }
  }, [currentBuild]);

  const compatibilityStatus = currentBuild.compatibilityStatus;
  const compatibilityIssues = currentBuild.compatibilityIssues;
  const totalPrice = currentBuild.totalPrice;

  return (
    <BuilderLayout
      leftPanel={<div>Left Panel</div>}
      centerPanel={<div>Center 3D PC</div>}
      rightPanel={<div>
        <CompatibilityStatus
          status={compatibilityStatus}
          issues={compatibilityIssues}
        />
        <PriceSummary
          total={totalPrice}
          breakdown={{
            cpu: CPUs.find(c => currentBuild.components.cpu?.id === c.id)?.price || 0,
            gpu: GPUs.find(c => currentBuild.components.gpu?.id === c.id)?.price || 0,
            motherboard: MOTHERBOARDS.find(c => currentBuild.components.motherboard?.id === c.id)?.price || 0,
            ram: RAM.find(c => currentBuild.components.ram?.id === c.id)?.price || 0,
            storage: STORAGE.find(c => currentBuild.components.storage?.id === c.id)?.price || 0,
            psu: PSUs.find(c => currentBuild.components.psu?.id === c.id)?.price || 0,
            case: CASES.find(c => currentBuild.components.case?.id === c.id)?.price || 0,
          }}
        />
      </div>}
      bottomPanel={<div>Bottom Panel</div>}
    />
  );
};