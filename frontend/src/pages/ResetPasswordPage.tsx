import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useResetPasswordMutation } from '../features/auth/authApi';
import AuthLayout from '../features/auth/AuthLayout';
import {
  inputClass,
  inputErrorClass,
  labelClass,
  submitClass,
  fieldErrorClass,
  getApiErrorMessage,
} from '../features/auth/authStyles';

interface FormValues {
  password: string;
  confirm: string;
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      await resetPassword({ token, password: values.password }).unwrap();
      navigate('/login', { replace: true });
    } catch {
      // Surfaced below via the `error` from the mutation hook.
    }
  };

  // No token in the URL — the link was truncated in transit (some mail
  // clients cut long URLs). Asking again beats a guaranteed server error.
  if (!token) {
    return (
      <AuthLayout
        title="Link incomplete"
        subtitle="The reset link didn't survive the trip"
        footer={
          <Link
            to="/forgot-password"
            className="text-brand-text hover:text-brand-700 font-medium"
          >
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-ink-muted leading-relaxed">
          Try copying the whole link from the email into the address bar, or
          request a fresh one — it only takes a minute.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Then sign in with it right away"
      footer={
        <>
          Link expired?{' '}
          <Link
            to="/forgot-password"
            className="text-brand-text hover:text-brand-700 font-medium"
          >
            Request a new one
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
            {getApiErrorMessage(error, 'This link is invalid or has expired')}
          </div>
        )}

        <div>
          <label htmlFor="password" className={labelClass}>
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            className={`${inputClass} ${errors.password ? inputErrorClass : ''}`}
            aria-invalid={Boolean(errors.password)}
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
            })}
          />
          {errors.password && (
            <p className={fieldErrorClass}>{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirm" className={labelClass}>
            Repeat it
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className={`${inputClass} ${errors.confirm ? inputErrorClass : ''}`}
            aria-invalid={Boolean(errors.confirm)}
            {...register('confirm', {
              validate: (value) =>
                value === watch('password') || 'Passwords do not match',
            })}
          />
          {errors.confirm && (
            <p className={fieldErrorClass}>{errors.confirm.message}</p>
          )}
        </div>

        <button type="submit" disabled={isLoading} className={submitClass}>
          {isLoading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
