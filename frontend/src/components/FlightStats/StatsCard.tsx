interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'pink';
}

const colorClasses = {
  blue: 'bg-brand-50 text-brand-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  pink: 'bg-pink-50 text-pink-600',
};

function StatsCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
      {/*
        Two of these sit side by side on a 390px screen, leaving ~130px of
        text width. At the old fixed sizes the titles and even values like
        "141,877 km" wrapped mid-number. Sizes step up with the viewport, and
        the icon hides on the narrowest screens rather than stealing width
        from the number it decorates.
      */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 whitespace-nowrap">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className={`hidden sm:block p-2 rounded-lg flex-shrink-0 ${colorClasses[color]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
