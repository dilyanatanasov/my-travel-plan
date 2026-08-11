import type { ReactNode } from 'react';
import BrandMark from '../../components/BrandMark';

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
            <BrandMark className="w-8 h-8" />
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
