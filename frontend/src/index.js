import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));

const AppTree = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

if (process.env.NODE_ENV === 'production') {
  root.render(
    <React.StrictMode>
      {AppTree}
    </React.StrictMode>
  );
} else {
  // Avoid double-invoking effects in development to prevent duplicate API calls
  root.render(AppTree);
}
