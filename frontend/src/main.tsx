import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store/store';
import { ThemeProvider } from './features/theme/ThemeContext';
import { ToastProvider } from './components/Toast/ToastProvider';
import { registerServiceWorker } from './registerServiceWorker';
import { initAnalytics } from './lib/analytics';
import App from './App';
// Tokens first: index.css and every Tailwind colour utility resolve against
// these custom properties.
import './styles/tokens.css';
import './index.css';
// Flag sprites for <CountryFlag>; SVGs load on demand, not into the bundle.
import 'flag-icons/css/flag-icons.min.css';

registerServiceWorker();
// No-op unless VITE_UMAMI_URL + VITE_UMAMI_WEBSITE_ID are set (prod only).
initAnalytics();

/*
  Self-heal from a stale deploy (owner report, 2026-08-18: "recording
  doesn't work" on a session whose cached shell referenced chunk files a
  newer deploy had replaced). Vite fires vite:preloadError when a lazy
  chunk 404s; one reload fetches the fresh shell and every hash lines up
  again. The sessionStorage guard stops a reload loop if the failure is
  something else (offline, a genuinely missing file).
*/
const RELOAD_KEY = 'contrail:chunk-reload';
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem(RELOAD_KEY)) return;
  sessionStorage.setItem(RELOAD_KEY, '1');
  event.preventDefault();
  window.location.reload();
});
// A load that survives 15s was healed - re-arm for the next deploy.
window.setTimeout(() => sessionStorage.removeItem(RELOAD_KEY), 15000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
