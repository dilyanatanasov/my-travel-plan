import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLoginMutation, type LoginRequest } from '../features/auth/authApi';
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
            className="text-brand-600 hover:text-brand-700 font-medium"
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
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
