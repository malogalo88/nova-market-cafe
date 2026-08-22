import { Component } from '../types/index';

export const ComponentCard = ({
  component,
  onRemove,
  isInstalled,
}: {
  component: Component;
  onRemove: () => void;
  isInstalled: boolean;
}) => {
  const cardClass = isInstalled
    ? 'border-green-500 p-4 rounded-md cursor-pointer'
    : 'border-gray-300 hover:border-blue-500 transition-colors p-4 rounded-md cursor-pointer';
  
  return (
    <div className={cardClass} onClick={() => {
      if (isInstalled) {
        onRemove();
      }
    }}>
      <span className="font-medium text-sm capitalize">{component.name}</span>
      <span className="text-xs text-muted-foreground">{component.brand}</span>
      <span className="text-xs capitalize my-1">{component.price}$</span>
      <span className="text-xs capitalize text-muted-foreground">{component.category}</span>
    </div>
  );
};