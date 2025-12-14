import type { InsightDto } from '../../../../types';

interface InsightsPanelProps {
  insights: InsightDto[];
}

function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  const typeStyles: Record<InsightDto['type'], { bg: string; border: string }> = {
    recommendation: { bg: 'bg-blue-50', border: 'border-blue-200' },
    tip: { bg: 'bg-green-50', border: 'border-green-200' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
    price_trend: { bg: 'bg-purple-50', border: 'border-purple-200' },
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span>💡</span>
        Insights
      </h3>
      <div className="space-y-2">
        {insights.map((insight, index) => {
          const styles = typeStyles[insight.type];
          return (
            <div
              key={index}
              className={`${styles.bg} ${styles.border} border rounded-lg px-4 py-3`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{insight.icon}</span>
                <div>
                  <p className="font-medium text-gray-800">{insight.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{insight.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InsightsPanel;
