import { fc } from 'react';
import { Link } from 'react-router-dom';

export const HomePage: fc.FunctionComponent = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-gray-300 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold tracking-tighter mb-2">
            <span className="text-primary-400">PCForge</span>
          </h1>
          <p className="text-lg text-gray-400">Build it. Check it. Game it.</p>
        </div>
        
        {/* Main features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          
          {/* Start Building Card */}
          <div 
            onClick={() => {}}
            className="group border-2 border-primary-500 rounded-2xl p-8 hover:border-primary-400 transition-colors cursor-pointer"
          >
            <div className="text-5xl mb-4">🔧</div>
            <h3 className="text-2xl font-bold mb-2">Start Building</h3>
            <p className="text-gray-400 group-hover:text-primary-400 transition-colors">
              Drag and drop components into your 3D PC case
            </p>
          </div>
          
          {/* Browse Parts Card */}
          <div 
            onClick={() => {}}
            className="group border-2 border-gray-700 rounded-2xl p-8 hover:border-gray-600 transition-colors cursor-pointer"
          >
            <div className="text-5xl mb-4">📦</div>
            <h3 className="text-2xl font-bold mb-2">Browse Parts</h3>
            <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
              Browse our extensive database of PC components
            </p>
          </div>
          
          {/* My Builds Card */}
          <div 
            onClick={() => {}}
            className="group border-2 border-gray-700 rounded-2xl p-8 hover:border-gray-600 transition-colors cursor-pointer"
          >
            <div className="text-5xl mb-4">💾</div>
            <h3 className="text-2xl font-bold mb-2">My Builds</h3>
            <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
              Save and share your PC builds
            </p>
          </div>
          
        </div>
        
        {/* How it works section */}
        <div className="mt-12 pt-8 border-t border-gray-800 text-center">
          <h2 className="text-3xl font-bold mb-4">How PCForge Works</h2>
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl mb-2">1</div>
              <h3 className="font-bold mb-2">Select Components</h3>
              <p className="text-gray-400">Choose from CPUs, GPUs, motherboards, and more</p>
            </div>
            <div>
              <div className="text-3xl mb-2">2</div>
              <h3 className="font-bold mb-2">Build in 3D</h3>
              <p className="text-gray-400">Watch your PC come to life interactively</p>
            </div>
            <div>
              <div className="text-3xl mb-2">3</div>
              <h3 className="font-bold mb-2">Check Compatibility</h3>
              <p className="text-gray-400">Ensure all parts work together seamlessly</p>
            </div>
          </div>
        </div>
        
        {/* Example build preview */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <h2 className="text-3xl font-bold mb-4">Example Build</h2>
          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="p-4 border rounded bg-gray-800">
              <h3 className="font-bold">Ryzen 5 5600</h3>
              <p className="text-xs text-gray-400">CPU</p>
              <p className="text-xs">$150</p>
            </div>
            <div className="p-4 border rounded bg-gray-800">
              <h3 className="font-bold">RTX 4060</h3>
              <p className="text-xs text-gray-400">GPU</p>
              <p className="text-xs">$300</p>
            </div>
            <div className="p-4 border rounded bg-gray-800">
              <h3 className="font-bold">B550 Tomahawk</h3>
              <p className="text-xs text-gray-400">Motherboard</p>
              <p className="text-xs">$130</p>
            </div>
            <div className="p-4 border rounded bg-gray-800">
              <h3 className="font-bold">16GB DDR4</h3>
              <p className="text-xs text-gray-400">RAM</p>
              <p className="text-xs">$55</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};