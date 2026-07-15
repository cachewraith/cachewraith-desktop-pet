import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';

import App from './app/App';
import CompanionApp from './app/CompanionApp';
import { ErrorBoundary } from './app/ErrorBoundary';
import SettingsApp from './app/SettingsApp';
import { companionPetIdFromLabel } from './services/windows/companionWindows';
import { configurePixelArt } from './utils/pixelArt';
import './styles/global.css';
import './styles/pet.css';
import './styles/chat.css';
import './styles/settings.css';

configurePixelArt();

const label = getCurrentWindow().label;
const isPetWindow = label === 'pet';
const companionPetId = companionPetIdFromLabel(label);

document.body.classList.add(isPetWindow || companionPetId ? 'window-pet' : 'window-settings');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {companionPetId ? (
        <CompanionApp petId={companionPetId} />
      ) : isPetWindow ? (
        <App />
      ) : (
        <SettingsApp />
      )}
    </ErrorBoundary>
  </React.StrictMode>
);
