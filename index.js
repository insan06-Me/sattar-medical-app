import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // This imports your main App.js component

// Create a root for your React application
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render your App component into the root
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

