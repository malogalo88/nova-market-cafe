import { fc } from 'react';
import { useBuildStore } from '../store/buildStore';
import { Link } from 'react-router-dom';

export const SavedBuildsPage: React.FC = () => {
  const {
    savedBuilds,
    deleteBuild,
    currentBuild,
  } = useBuildStore();

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">My Saved Builds</h1>
      
      {savedBuilds.length === 0 ? (
        <div className="text-gray-400 text-center py-12">
          <p>No builds saved yet</p>
          <p className="mt-2">Start building your first PC!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {savedBuilds.map((build) => (
            <div
              key={build.id}
              className="border rounded-lg p-6 hover:bg-gray-800 transition-colors cursor-pointer"
              onClick={() => {}}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-lg">{build.name}</h3>
                <span className="text-sm text-gray-400">
                  {build.totalPrice.toLocaleString()}&#36;
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.keys(build.components).map((cat) => {
                  const comp = build.components[cat as any];
                  if (comp) {
                    return (
                      <div key={cat}>
                        <span className="capitalize text-gray-300">{cat.charAt(0).toUpperCase() + cat.slice(1)}:</span>
                        <span className="text-primary-400 capitalize">{comp.name}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-primary-400 font-medium">Score: {build.overallScore}/100</div>
                <p className="text-xs text-gray-500 mt-1">
                  Created: {new Date(build.createdAt).toLocaleDateString()}
                </p>
              </div>
              
              <Link
                to={`/build/${build.id}`}
                className="mt-3 inline-block text-primary-400 text-sm hover:underline"
              >
                View Details
              </Link>
              
              <button
                onClick={() => deleteBuild(build.id)}
                className="mt-2 text-red-400 text-sm hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};