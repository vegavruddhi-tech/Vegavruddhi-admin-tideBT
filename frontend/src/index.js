import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '175231524136-39m136pat1dpous6u9eijhfulpmpms1i.apps.googleusercontent.com';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// Register Service Worker for 50ms-120ms API + asset caching matching reference panel
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => console.log('✅ ServiceWorker registered:', reg.scope))
      .catch((err) => console.warn('⚠️ ServiceWorker registration failed:', err));
  });
}
