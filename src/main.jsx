import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/style.css';
import './styles/player.css';
import './styles/lyrics.css';
import './styles/skin-spotify.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);