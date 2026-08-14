import { forwardRef, type ButtonHTMLAttributes } from 'react';

/**
 * The app's button (2026-08-14, user rule: shared primitives over pasted
 * class strings). Variants are the exact styles already shipped, so
 * migrating a raw <button> here is a no-op visually.
 *
 * Icon-only map chrome (zoom stack, card corner buttons) stays bespoke —
 * those are positioned glyphs with map-glass styling, not text buttons.
 */

type Variant =
  /** Filled brand — the one primary action of a view. */
  | 'primary'
  /** Brand outline — secondary action beside a primary. */
  | 'outline'
  /** Neutral border — tertiary actions. */
  | 'neutral'
  /** Filled red — the destructive confirm itself. */
  | 'danger'
  /** Red text, soft hover — the step before a destructive confirm. */
  | 'dangerGhost'
  /** Muted text — cancel and other quiet actions. */
  | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  outline: 'border border-brand-600 text-brand-700 hover:bg-brand-50',
  neutral: 'border border-line text-ink hover:bg-surface-sunken',
  danger: 'bg-danger text-white',
  dangerGhost: 'text-danger hover:bg-danger-soft',
  ghost: 'text-ink-muted hover:bg-surface-sunken',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** md = min-h-11 (the 44px touch floor); sm = min-h-10 for dense rows. */
  size?: 'md' | 'sm';
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    type = 'button',
    className = '',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        'inline-flex items-center justify-center rounded-lg text-sm font-medium px-4',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        'disabled:opacity-50',
        size === 'md' ? 'min-h-11' : 'min-h-10',
        fullWidth ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});

export default Button;
