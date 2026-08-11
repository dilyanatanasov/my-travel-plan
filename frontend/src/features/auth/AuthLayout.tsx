import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Shared shell for the login and register screens. */
function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="scroll-page bg-canvas flex flex-col justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white mb-4">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="text-ink-muted mt-1">{subtitle}</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-line p-6">
          {children}
        </div>

        <p className="text-center text-sm text-ink-muted mt-6">{footer}</p>
      </div>
    </div>
  );
}

export default AuthLayout;
