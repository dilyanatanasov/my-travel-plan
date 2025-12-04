import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import HomePage from './pages/HomePage';
import FlightsPage from './pages/FlightsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="flights" element={<FlightsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
