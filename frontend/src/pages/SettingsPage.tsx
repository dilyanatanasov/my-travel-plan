import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useTheme,
  type ThemePreference,
} from '../features/theme/ThemeContext';
import {
  useAuth,
  useChangePasswordMutation,
  useDeleteAccountMutation,
} from '../features/auth/authApi';
import { downloadBlob } from '../utils/exportMapImage';
import {
  useGetCountriesQuery,
  useGetVisitsQuery,
  useSetHomeCountryMutation,
} from '../features/visits/visitsApi';
import { useToast } from '../components/Toast/ToastProvider';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
  { value: 'system', label: 'System', hint: 'Follow your device' },
];

function ThemeSwatch({ mode }: { mode: ThemePreference }) {
  // A miniature of the app: canvas, a surface card, and the accent.
  const tones =
    mode === 'dark'
      ? { canvas: '#201e1d', surface: '#2e2b25', accent: '#f6a06b' }
      : mode === 'light'
        ? { canvas: '#f5ead8', surface: '#f9f4ed', accent: '#9c5220' }
        : { canvas: '#f5ead8', surface: '#2e2b25', accent: '#d67f48' };

  return (
    <span
      aria-hidden="true"
      className="block w-full h-12 rounded-lg overflow-hidden border border-line"
      style={{ backgroundColor: tones.canvas }}
    >
      <span
        className="block h-6 m-1.5 rounded"
        style={{ backgroundColor: tones.surface }}
      />
      <span
        className="block h-1.5 mx-1.5 rounded"
        style={{ backgroundColor: tones.accent }}
      />
    </span>
  );
}

function SettingsPage() {
  const { preference, resolved, setPreference } = useTheme();
  const { user, isGuest } = useAuth();
  const { data: countries = [] } = useGetCountriesQuery();
  const { data: visits = [] } = useGetVisitsQuery();
  const [setHomeCountry, { isLoading: isSavingHome }] = useSetHomeCountryMutation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [deleteAccount, { isLoading: isDeleting }] = useDeleteAccountMutation();
  const [isExporting, setIsExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [changePassword, { isLoading: isChangingPassword }] =
    useChangePasswordMutation();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      showToast('The new password needs at least 8 characters', {
        tone: 'error',
      });
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password changed', { tone: 'success' });
    } catch {
      showToast('Wrong current password', { tone: 'error' });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Same-origin cookie auth, same base the API slice uses.
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
      const response = await fetch(`${base}/auth/export`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      downloadBlob(blob, 'mycontrail-export.json');
      showToast('Your data has been downloaded', { tone: 'success' });
    } catch {
      showToast('Could not export your data — try again', { tone: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAccount(
        isGuest ? {} : { password: deletePassword },
      ).unwrap();
      showToast('Your account and all its data have been deleted');
      navigate('/');
    } catch {
      showToast(
        isGuest ? 'Could not delete the account' : 'Wrong password',
        { tone: 'error' },
      );
    }
  };

  const homeCountryId =
    visits.find((visit) => visit.visitType === 'home')?.countryId ?? '';

  const handleHomeChange = async (value: string) => {
    const id = Number.parseInt(value, 10);
    if (!id) return;
    try {
      await setHomeCountry(id).unwrap();
    } catch {
      showToast('Could not set your home country', { tone: 'error' });
    }
  };

  return (
    <div className="scroll-page bg-canvas">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-ink">Settings</h1>
          <Link
            to="/"
            className="inline-flex items-center min-h-11 px-3 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Back to map
          </Link>
        </div>

        <section
          aria-labelledby="appearance-heading"
          className="bg-surface border border-line rounded-xl p-4 sm:p-5 mb-4"
        >
          <h2
            id="appearance-heading"
            className="text-base font-semibold text-ink"
          >
            Appearance
          </h2>
          <p className="text-sm text-ink-muted mt-0.5 mb-4">
            Currently showing the {resolved} theme.
          </p>

          {/* radiogroup rather than buttons: this is a single choice from a
              set, and arrow-key navigation comes free. */}
          <div role="radiogroup" aria-labelledby="appearance-heading" className="grid grid-cols-3 gap-3">
            {OPTIONS.map((option) => {
              const isSelected = preference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setPreference(option.value)}
                  className={`text-left p-2 rounded-xl border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  <ThemeSwatch mode={option.value} />
                  <span className="block mt-2 text-sm font-medium text-ink">
                    {option.label}
                  </span>
                  <span className="block text-xs text-ink-subtle">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-ink-subtle mt-4">
            The map itself stays dark in both themes — it reads as a canvas
            rather than a panel, which is what keeps routes and countries
            legible on top of it.
          </p>
        </section>

        {/*
          Home country lives here, not in the map's filter panel.

          Everything else in that panel is a view toggle — it changes what you
          are looking at and nothing else. This writes to your data: it
          rewrites a visit's type, and switching it moves the marker off
          whichever country held it. A control that edits records should not
          sit among controls that only change the view.
        */}
        <section
          aria-labelledby="home-heading"
          className="bg-surface border border-line rounded-xl p-4 sm:p-5 mb-4"
        >
          <h2 id="home-heading" className="text-base font-semibold text-ink">
            Home country
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Drawn in its own colour on the map. It still counts as visited —
            only transit stops are left out.
          </p>
          <select
            value={homeCountryId}
            disabled={isSavingHome}
            onChange={(e) => handleHomeChange(e.target.value)}
            aria-label="Home country"
            className="select-field mt-3 min-h-11 w-full text-base sm:text-sm bg-surface border border-line rounded-lg pl-3 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
          >
            <option value="">Not set</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </section>

        <section
          aria-labelledby="account-heading"
          className="bg-surface border border-line rounded-xl p-4 sm:p-5"
        >
          <h2 id="account-heading" className="text-base font-semibold text-ink">
            Account
          </h2>
          {/*
            A guest reaching Settings is already thinking about "my account",
            which makes this the one place the prompt is answering a question
            rather than interrupting one. The home country control above stays
            available to them: gating a cosmetic map setting adds friction
            while someone is still deciding, and the gates that actually
            convert are the things people want in the moment — a share link,
            a video.
          */}
          {isGuest ? (
            <>
              <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                You don&rsquo;t have one yet. Your map lives on this device
                only — clear your browser or switch phones and it&rsquo;s
                gone. An account keeps it, and lets you share it.
              </p>
              <Link
                to="/register"
                className="mt-3 flex items-center justify-center w-full min-h-11 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                Create free account
              </Link>
              <Link
                to="/login"
                className="mt-1 flex items-center justify-center w-full min-h-10 text-sm text-ink-muted hover:text-ink"
              >
                I already have one
              </Link>
            </>
          ) : (
            <>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Name</dt>
                  <dd className="text-ink truncate">
                    {user?.displayName || 'Not set'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Email</dt>
                  <dd className="text-ink truncate">{user?.email}</dd>
                </div>
              </dl>
              {!showPasswordForm ? (
                <Button
                  variant="neutral"
                  fullWidth
                  className="mt-4"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Change password…
                </Button>
              ) : (
                <div className="mt-4 space-y-2">
                  <TextInput
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    aria-label="Current password"
                  />
                  <TextInput
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (at least 8 characters)"
                    aria-label="New password"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleChangePassword}
                      disabled={
                        isChangingPassword || !currentPassword || !newPassword
                      }
                    >
                      {isChangingPassword ? 'Saving…' : 'Save new password'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword('');
                        setNewPassword('');
                      }}
                      disabled={isChangingPassword}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-ink-subtle">
                    Forgot it? Sign out and use &ldquo;Forgot password&rdquo;
                    on the login page instead.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* GDPR rights, as features: portability and erasure. */}
        <section
          aria-labelledby="data-heading"
          className="bg-surface border border-line rounded-xl p-4 sm:p-5 mt-4"
        >
          <h2 id="data-heading" className="text-base font-semibold text-ink">
            Your data
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Everything you have entered belongs to you. See the{' '}
            <Link to="/privacy" className="text-brand-700 hover:underline">
              privacy policy
            </Link>{' '}
            and{' '}
            <Link to="/terms" className="text-brand-700 hover:underline">
              terms
            </Link>
            .
          </p>

          <Button
            variant="outline"
            fullWidth
            className="mt-3"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Preparing…' : 'Download my data (JSON)'}
          </Button>

          {!confirmingDelete ? (
            <Button
              variant="dangerGhost"
              fullWidth
              className="mt-2"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete my account…
            </Button>
          ) : (
            <div className="mt-3 border border-danger/30 rounded-lg p-3 space-y-2">
              <p className="text-xs text-ink-muted leading-relaxed">
                This permanently deletes your account, countries, flights and
                any share or duel links. There is no undo — consider
                downloading your data first.
              </p>
              {!isGuest && (
                <TextInput
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  aria-label="Confirm your password to delete the account"
                />
              )}
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={isDeleting || (!isGuest && !deletePassword)}
                >
                  {isDeleting ? 'Deleting…' : 'Permanently delete everything'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeletePassword('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default SettingsPage;
