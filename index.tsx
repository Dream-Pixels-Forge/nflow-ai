import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import App from './App';
import { initializeStartupTracking, reportStartupError } from './src/utils/StartupTracker';

// Initialize startup tracking
initializeStartupTracking();

// Set up error boundaries for the app
const rootElement = document.getElementById('root');
if (!rootElement) {
  reportStartupError("Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Global error handler for uncaught errors during startup
window.addEventListener('error', (event) => {
  reportStartupError(`Application startup error: ${event.error?.message || 'Unknown error'}`);
});

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
