import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  useAuth,
  useRegisterMutation,
  type RegisterRequest,
} from '../features/auth/authApi';
import { useGetVisitsQuery } from '../features/visits/visitsApi';
import { useGetFlightStatsQuery } from '../features/flights/flightsApi';
import AuthLayout from '../features/auth/AuthLayout';
import { track } from '../lib/analytics';
import {
  inputClass,
  inputErrorClass,
  labelClass,
  submitClass,
  fieldErrorClass,
  getApiErrorMessage,
} from '../features/auth/authStyles';

function RegisterPage() {
  const navigate = useNavigate();
  const [registerUser, { isLoading, error }] = useRegisterMutation();

  /*
    A guest signing up keeps the map they already built — the server upgrades
    their existing row rather than creating a second account. Saying so with
    real numbers matters: without it, "create an account" reads like starting
    over, which is exactly the fear that stops someone pressing the button.
  */
  const { isGuest } = useAuth();
  const { data: visits = [] } = useGetVisitsQuery(undefined, { skip: !isGuest });
  const { data: flightStats } = useGetFlightStatsQuery(undefined, {
    skip: !isGuest,
  });

  const carriedOver: string[] = [];
  if (visits.length) {
    carriedOver.push(
      `${visits.length} ${visits.length === 1 ? 'country' : 'countries'}`
    );
  }
  if (flightStats?.totalFlights) {
    carriedOver.push(
      `${flightStats.totalFlights} ${
        flightStats.totalFlights === 1 ? 'flight' : 'flights'
      }`
    );
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterRequest>();

  const onSubmit = async (values: RegisterRequest) => {
    // Captured before the mutation flips it: was this a guest converting?
    const wasGuest = isGuest;
    try {
      await registerUser({
        ...values,
        displayName: values.displayName?.trim() || undefined,
      }).unwrap();
      if (wasGuest) {
        // The funnel number that matters. No properties at all.
        track('guest_convert');
      }
      navigate('/', { replace: true });
    } catch {
      // Surfaced below via the `error` from the mutation hook.
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start mapping where you've been"
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-brand-text hover:text-brand-700 font-medium"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* No dark: variants — the brand ramp is inverted per theme in
            tokens.css, so 50-on-800 stays readable in both. */}
        {isGuest && carriedOver.length > 0 && (
          <div className="bg-brand-50 border border-brand-200 text-brand-800 px-3 py-2 rounded-lg text-sm">
            Your {carriedOver.join(' and ')} will be saved to this account.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="bg-danger-soft border border-danger/30 text-danger px-3 py-2 rounded-lg text-sm"
          >
            {getApiErrorMessage(error, 'Could not create your account')}
          </div>
        )}

        <div>
          <label htmlFor="displayName" className={labelClass}>
            Name <span className="text-ink-subtle font-normal">(optional)</span>
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            autoFocus
            className={inputClass}
            {...register('displayName', {
              maxLength: { value: 100, message: 'Name is too long' },
            })}
          />
          {errors.displayName && (
            <p className={fieldErrorClass}>{errors.displayName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`${inputClass} ${errors.email ? inputErrorClass : ''}`}
            aria-invalid={Boolean(errors.email)}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address',
              },
            })}
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
            autoComplete="new-password"
            className={`${inputClass} ${errors.password ? inputErrorClass : ''}`}
            aria-invalid={Boolean(errors.password)}
            aria-describedby="password-hint"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
            })}
          />
          {errors.password ? (
            <p className={fieldErrorClass}>{errors.password.message}</p>
          ) : (
            <p id="password-hint" className="mt-1 text-sm text-ink-muted">
              At least 8 characters.
            </p>
          )}
        </div>

        <button type="submit" disabled={isLoading} className={submitClass}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;
