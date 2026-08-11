interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'pink';
}

const colorClasses = {
  /*
    One chip treatment, not four. The Organic system has a single accent, and
    four differently-coloured discs read as decoration competing with the
    numbers they sit beside.

    brand-700 for the glyph exploits the ramp's inversion rather than fighting
    it: dark terracotta on a pale tint in light mode, pale terracotta on a
    dark tint in dark mode, legible in both without a single override. The
    previous bg-brand-50 was near-black in dark mode and swallowed the icon.
  */
  blue: 'bg-brand-500/15 text-brand-700',
  green: 'bg-brand-500/15 text-brand-700',
  purple: 'bg-brand-500/15 text-brand-700',
  orange: 'bg-brand-500/15 text-brand-700',
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
    <div className="bg-surface rounded-xl border border-line p-3 sm:p-4 hover:shadow-md transition-shadow">
      {/*
        Two of these sit side by side on a 390px screen, leaving ~130px of
        text width. At the old fixed sizes the titles and even values like
        "141,877 km" wrapped mid-number. Sizes step up with the viewport, and
        the icon hides on the narrowest screens rather than stealing width
        from the number it decorates.
      */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-ink-muted mb-1">{title}</p>
          <p className="font-display font-normal text-xl sm:text-3xl text-ink whitespace-nowrap">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-ink-subtle mt-1">{subtitle}</p>
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
