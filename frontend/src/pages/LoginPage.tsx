import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  useLoginMutation,
  forgetAccount,
  type LoginRequest,
} from '../features/auth/authApi';
import AuthLayout from '../features/auth/AuthLayout';
import {
  inputClass,
  inputErrorClass,
  labelClass,
  submitClass,
  fieldErrorClass,
  getApiErrorMessage,
} from '../features/auth/authStyles';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading, error }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>();

  // Send people back where they were headed before the redirect.
  const from =
    (location.state as { from?: string } | null)?.from ?? '/';

  /**
   * Leaves the login screen without an account.
   *
   * This page is reachable without asking for it: RequireAuth sends anyone
   * whose device remembers an account here when the session has lapsed. That
   * is right for the owner, and a dead end for everyone else — a borrowed
   * phone, or someone who cannot remember the password had no route back to
   * the map at all.
   *
   * Clearing the flag is what unblocks the gate, so it has to be deliberate
   * rather than a stray tap: the saved map is not gone, but it is not on
   * screen either until they sign back in.
   */
  const handleBrowseAsGuest = () => {
    forgetAccount();
    navigate('/', { replace: true });
  };

  const onSubmit = async (values: LoginRequest) => {
    try {
      await login(values).unwrap();
      navigate(from, { replace: true });
    } catch {
      // Surfaced below via the `error` from the mutation hook.
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see your travel map"
      footer={
        <>
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-brand-text hover:text-brand-700 font-medium"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="bg-danger-soft border border-danger/30 text-danger px-3 py-2 rounded-lg text-sm"
          >
            {getApiErrorMessage(error, 'Incorrect email or password')}
          </div>
        )}

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            className={`${inputClass} ${errors.email ? inputErrorClass : ''}`}
            aria-invalid={Boolean(errors.email)}
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p className={fieldErrorClass}>{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={`${inputClass} ${errors.password ? inputErrorClass : ''}`}
            aria-invalid={Boolean(errors.password)}
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && (
            <p className={fieldErrorClass}>{errors.password.message}</p>
          )}
        </div>

        <button type="submit" disabled={isLoading} className={submitClass}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="pt-2 border-t border-line text-center">
          <button
            type="button"
            onClick={handleBrowseAsGuest}
            className="min-h-11 px-3 text-sm font-medium text-brand-text hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
          >
            Look around without an account
          </button>
          <p className="text-xs text-ink-subtle mt-0.5">
            Your saved map stays where it is — sign in any time to get it back.
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
