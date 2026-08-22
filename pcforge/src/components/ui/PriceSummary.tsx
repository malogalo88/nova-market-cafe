export const PriceSummary = ({
  total,
  breakdown,
  budget,
}: {
  total: number;
  breakdown: Record<string, number>;
  budget?: number;
}) => {
  const overBudget = budget && total > budget;
  const totalStr = total.toLocaleString();
  
  return (
    <div>
      <div className="font-medium text-sm mb-2">YOUR BUILD</div>
      <div className="space-y-1 text-sm">
        {Object.entries(breakdown).map(([component, price]) => {
          const priceStr = price.toLocaleString();
          return (
            <div key={component}>
              <span className="line-through text-muted-foreground mr-1">{component}</span>
              <span>{priceStr}$</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
        <span className="font-bold text-lg">TOTAL: {totalStr}$</span>
        {budget && (
          <div className={overBudget ? 'text-red-500' : 'text-green-500'}>
            {totalStr}$ / {budget.toLocaleString()}$
          </div>
        )}
      </div>
      {overBudget && (
        <div className="mt-2 p-2 bg-red-100 text-red-600 rounded-sm text-xs">
          ⚠️ Over budget by {(total - budget).toLocaleString()}$;
        </div>
      )}
    </div>
  );
};