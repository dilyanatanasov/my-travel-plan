import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store/store';
import { ToastProvider } from './components/Toast/ToastProvider';
import { registerServiceWorker } from './registerServiceWorker';
import App from './App';
// Tokens first: index.css and every Tailwind colour utility resolve against
// these custom properties.
import './styles/tokens.css';
import './index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
