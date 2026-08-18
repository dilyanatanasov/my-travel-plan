import { Suspense, lazy } from 'react';
import ContrailLoader from './components/ContrailLoader';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import TravelMapPage from './pages/TravelMapPage';
import RequireAuth from './features/auth/RequireAuth';
import { useVersionCheck } from './lib/useVersionCheck';

// TravelMapPage is the index route and the map library it pulls is needed at
// first paint, so it stays in the initial chunk. Everything else is reachable
// only after a navigation, so it is split into its own chunk and fetched on
// demand — this is what keeps the map's first load small.
const WhereNextPage = lazy(() => import('./pages/WhereNextPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const SharedMapPage = lazy(() => import('./pages/SharedMapPage'));
const DuelPage = lazy(() => import('./pages/DuelPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const DailyPage = lazy(() => import('./pages/DailyPage'));
const TripSearchPage = lazy(() => import('./pages/TripSearchPage'));

function App() {
  // Stale open tabs get a "new version — reload" toast after deploys.
  useVersionCheck();

  return (
    // A lazy route resolves in well under a paint on a warm cache; the
    // loader's own 350ms appearance delay keeps fast navigations
    // flash-free, while a cold load gets the contrail drawing itself.
    <Suspense fallback={<ContrailLoader fullScreen />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Emailed-link landings — public: the email may open a fresh browser */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        {/* Legal pages — public: linked from registration */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        {/* The daily guesser — public by design: the game is the funnel */}
        <Route path="/daily" element={<DailyPage />} />
        {/* Public shared map — deliberately outside RequireAuth */}
        <Route path="/s/:token" element={<SharedMapPage />} />
        {/* Duels: public like the maps they compose; depth gated in-page */}
        <Route path="/duel/:tokenA" element={<DuelPage />} />
        <Route path="/duel/:tokenA/:tokenB" element={<DuelPage />} />

        {/* Everything below renders user data and requires a session */}
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<TravelMapPage />} />
            {/* Redirect old routes to home */}
            <Route path="countries" element={<Navigate to="/" replace />} />
          </Route>
          <Route path="/settings" element={<SettingsPage />} />
          {/* Destination discovery — "where haven't I been that's cheap" */}
          <Route path="/search" element={<WhereNextPage />} />
          {/* The v2 funnel — destination known, dates unknown */}
          <Route path="/search/trips" element={<TripSearchPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
