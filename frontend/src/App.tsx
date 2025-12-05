import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import TravelMapPage from './pages/TravelMapPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<TravelMapPage />} />
        {/* Redirect old routes to home */}
        <Route path="flights" element={<Navigate to="/" replace />} />
        <Route path="countries" element={<Navigate to="/" replace />} />
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
