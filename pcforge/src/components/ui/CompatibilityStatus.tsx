import { ComponentCategory } from '../types/index';

export const CompatibilityStatus = ({
  status,
  issues,
}: {
  status: 'compatible' | 'warning' | 'incompatible';
  issues: any[];
}) => {
  const statusLabels: Record<'compatible' | 'warning' | 'incompatible', string> = {
    compatible: '✅ Compatible',
    warning: '⚠️ Warning',
    incompatible: '❌ Incompatible',
  };
  
  const statusClass: Record<'compatible' | 'warning' | 'incompatible', string> = {
    compatible: 'text-green-400',
    warning: 'text-yellow-400',
    incompatible: 'text-red-400',
  };
  
  return (
    <div className="p-4 rounded-md mb-4">
      <div className={statusClass[status]} font-medium>{statusLabels[status]}</div>
      {issues.length > 0 && (
        <div className="mt-2 text-xs">
          {issues.map((issue, index) => (
            <div key={index} className="mt-1">
              <span className="w-1 h-1 rounded-full mr-2 flex-shrink-0"
                style={{ backgroundColor: issue.severity === 'error' ? 'red' : issue.severity === 'warning' ? 'yellow' : 'green' }}
              ></span>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};