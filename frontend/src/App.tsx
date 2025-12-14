import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import TravelMapPage from './pages/TravelMapPage';
import FlightSearchPage from './pages/FlightSearchPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<TravelMapPage />} />
        {/* Redirect old routes to home */}
        <Route path="countries" element={<Navigate to="/" replace />} />
      </Route>
      {/* Flight search has its own layout */}
      <Route path="/search" element={<FlightSearchPage />} />
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
