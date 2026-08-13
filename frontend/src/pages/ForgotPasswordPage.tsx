import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useForgotPasswordMutation } from '../features/auth/authApi';
import AuthLayout from '../features/auth/AuthLayout';
import {
  inputClass,
  inputErrorClass,
  labelClass,
  submitClass,
  fieldErrorClass,
} from '../features/auth/authStyles';

interface FormValues {
  email: string;
}

function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [submittedTo, setSubmittedTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      await forgotPassword({ email: values.email }).unwrap();
    } catch {
      // Deliberately swallowed: the server answers ok either way, so the only
      // failures here are network/throttle — the confirmation below still
      // tells the user what to do next (check inbox, retry in a minute).
    }
    setSubmittedTo(values.email);
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one"
      footer={
        <>
          Remembered it?{' '}
          <Link
            to="/login"
            className="text-brand-text hover:text-brand-700 font-medium"
          >
            Sign in
          </Link>
        </>
      }
    >
      {submittedTo ? (
        <div className="space-y-3">
          <p className="text-sm text-ink leading-relaxed" role="status">
            If an account exists for <strong>{submittedTo}</strong>, a reset
            link is on its way. It works once and expires in 1 hour.
          </p>
          <p className="text-xs text-ink-muted leading-relaxed">
            Nothing arriving? Check spam, or make sure you typed the address
            you signed up with.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

          <button type="submit" disabled={isLoading} className={submitClass}>
            {isLoading ? 'Sending…' : 'Email me a reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
