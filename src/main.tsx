import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';

import App from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import SettingsApp from './app/SettingsApp';
import { configurePixelArt } from './utils/pixelArt';
import './styles/global.css';
import './styles/pet.css';
import './styles/chat.css';
import './styles/settings.css';

configurePixelArt();

const label = getCurrentWindow().label;
const isPetWindow = label === 'pet';

document.body.classList.add(isPetWindow ? 'window-pet' : 'window-settings');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>{isPetWindow ? <App /> : <SettingsApp />}</ErrorBoundary>
  </React.StrictMode>
);
