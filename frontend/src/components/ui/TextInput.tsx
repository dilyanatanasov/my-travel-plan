import { forwardRef, type InputHTMLAttributes } from 'react';

/**
 * The app's text input (2026-08-14, same shared-primitive rule as Button).
 * forwardRef so react-hook-form's register() can adopt it later.
 */
const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className = '', ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={[
        'w-full min-h-10 px-3 border border-line rounded-lg bg-surface text-ink text-sm',
        'placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-500',
        'disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});

export default TextInput;
