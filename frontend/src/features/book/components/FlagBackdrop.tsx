import CountryFlag from '../../../components/ui/CountryFlag';

/** A flag at any size: flag-icons sizes off font-size (4:3 box, 1em tall). */
function BigFlag({ iso2, size }: { iso2: string; size: number }) {
  return (
    <span className="block leading-none" style={{ fontSize: size }}>
      <CountryFlag iso2={iso2} className="!w-[1.3333em] !rounded-none !block" />
    </span>
  );
}

/** Faded so the flag reads as paper colour, not a sticker on top of the text. */
const WASH = 'opacity-[0.13] dark:opacity-[0.12] saturate-[0.75]';
/** Collages sit under more text, so they whisper. */
const WASH_SOFT = 'opacity-[0.10] dark:opacity-[0.09] saturate-[0.7]';

/**
 * Flags printed faintly into the page, like a watermark (owner direction,
 * 2026-10-27: "country flags in background with some styling").
 *
 * - `corner`: the trip's flags, large and tilted, bleeding off a corner.
 * - `collage`: many small flags scattered like stickers, for chapter
 *   openers and the intro.
 */
function FlagBackdrop({
  flags,
  variant,
  corner = 'bottom-right',
  area = 'full',
}: {
  flags: string[];
  variant: 'corner' | 'collage';
  corner?: 'bottom-right' | 'top-right' | 'bottom-left';
  /** Collage only: the whole page, or just its lower part below the text. */
  area?: 'full' | 'bottom';
}) {
  if (flags.length === 0) return null;

  if (variant === 'corner') {
    const shown = flags.slice(0, 3);
    const anchor =
      corner === 'top-right'
        ? { top: '-6%', right: '-14%' }
        : corner === 'bottom-left'
          ? { bottom: '-8%', left: '-16%' }
          : { bottom: '-8%', right: '-16%' };
    return (
      <div
        className={`absolute ${WASH}`}
        style={{
          ...anchor,
          width: '78%',
          transform: 'rotate(-9deg)',
          maskImage: 'radial-gradient(closest-side, black 55%, transparent)',
          WebkitMaskImage: 'radial-gradient(closest-side, black 55%, transparent)',
        }}
      >
        {shown.map((iso, i) => (
          <div
            key={iso}
            className="absolute"
            style={{ top: `${i * 18}%`, left: `${i * 10}%`, filter: i > 0 ? 'blur(0.4px)' : undefined }}
          >
            <BigFlag iso2={iso} size={170 - i * 30} />
          </div>
        ))}
        {/* Reserve height for the absolutely placed flags. */}
        <div style={{ paddingTop: '90%' }} />
      </div>
    );
  }

  // Collage: a loose grid, every flag nudged and turned a little differently.
  const shown = flags.slice(0, 30);
  const columns = shown.length <= 4 ? 2 : shown.length <= 12 ? 3 : 5;
  return (
    <div
      className={[
        'absolute grid content-center justify-items-center gap-y-4 p-6',
        area === 'bottom' ? 'inset-x-0 bottom-0 h-[44%]' : 'inset-0',
        WASH_SOFT,
      ].join(' ')}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        maskImage: 'radial-gradient(75% 65% at 50% 50%, black 40%, transparent)',
        WebkitMaskImage: 'radial-gradient(75% 65% at 50% 50%, black 40%, transparent)',
      }}
    >
      {shown.map((iso, i) => {
        const turn = ((i * 37) % 17) - 8;
        const lift = ((i * 23) % 11) - 5;
        return (
          <div key={iso} style={{ transform: `rotate(${turn}deg) translateY(${lift}px)` }}>
            <BigFlag iso2={iso} size={columns === 2 ? 64 : columns === 3 ? 44 : 28} />
          </div>
        );
      })}
    </div>
  );
}

export default FlagBackdrop;
