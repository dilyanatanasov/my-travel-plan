import CountryFlag from '../../../components/ui/CountryFlag';

/** Ink colours a border officer might reach for; picked per country, stable. */
const INKS = ['#8c3b2a', '#2f5d7c', '#4f6b3a', '#6b3f6e', '#9c5220', '#1f6f6b'];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * An entry stamp for a country's first visit. Shape, ink and tilt come
 * from the country code, so a country always gets the same stamp.
 */
function PassportStamp({
  iso2,
  name,
  date,
  size = 112,
}: {
  iso2: string;
  name: string;
  /** Short date line, e.g. "MAY 2019". */
  date: string | null;
  size?: number;
}) {
  const h = hash(iso2);
  const ink = INKS[h % INKS.length];
  const round = h % 3 !== 0;
  const tilt = (h % 19) - 9;
  const label = name.toUpperCase();

  return (
    <div
      className="relative flex flex-col items-center justify-center text-center mix-blend-multiply dark:mix-blend-screen"
      style={{
        width: size,
        height: round ? size : size * 0.72,
        color: ink,
        transform: `rotate(${tilt}deg)`,
        opacity: 0.85,
      }}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {round ? (
          <>
            <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2.5" />
          </>
        ) : (
          <>
            <rect x="3" y="3" width="94" height="94" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
            <rect x="9" y="9" width="82" height="82" rx="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </>
        )}
      </svg>
      <CountryFlag iso2={iso2} className="!w-6 mb-1 opacity-90" />
      <span
        className="relative font-semibold leading-tight tracking-wide px-3"
        style={{ fontSize: label.length > 14 ? 8 : label.length > 9 ? 9.5 : 11 }}
      >
        {label}
      </span>
      {date && (
        <span className="relative text-[8px] font-mono tracking-widest mt-0.5">{date}</span>
      )}
      <span className="relative text-[7px] tracking-[0.2em] mt-0.5 opacity-80">ENTRY</span>
    </div>
  );
}

export default PassportStamp;
