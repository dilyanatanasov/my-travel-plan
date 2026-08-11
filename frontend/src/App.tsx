import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import TravelMapPage from './pages/TravelMapPage';
import FlightSearchPage from './pages/FlightSearchPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SharedMapPage from './pages/SharedMapPage';
import SettingsPage from './pages/SettingsPage';
import RequireAuth from './features/auth/RequireAuth';

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Public shared map — deliberately outside RequireAuth */}
      <Route path="/s/:token" element={<SharedMapPage />} />

      {/* Everything below renders user data and requires a session */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<TravelMapPage />} />
          {/* Redirect old routes to home */}
          <Route path="countries" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="/settings" element={<SettingsPage />} />
        {/* Flight search has its own layout */}
        <Route path="/search" element={<FlightSearchPage />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
