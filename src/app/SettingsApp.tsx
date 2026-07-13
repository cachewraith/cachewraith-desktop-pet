/**
 * Settings window application with sidebar navigation and first-run
 * onboarding.
 */
import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

import { AboutSection } from '../components/settings/AboutSection';
import { AiSection } from '../components/settings/AiSection';
import { DataSection } from '../components/settings/DataSection';
import { GeneralSection } from '../components/settings/GeneralSection';
import { Onboarding } from '../components/settings/Onboarding';
import { PetSection } from '../components/settings/PetSection';
import { getPreference } from '../services/storage/preferences';
import { AppEvents } from '../types/events';

type SectionName = 'general' | 'pet' | 'ai' | 'data' | 'about';

const SECTIONS: { id: SectionName; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'pet', label: 'Pet' },
  { id: 'ai', label: 'AI' },
  { id: 'data', label: 'Data' },
  { id: 'about', label: 'About' },
];

export default function SettingsApp() {
  const [section, setSection] = useState<SectionName>('general');
  const [firstRun, setFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    void getPreference('firstRunDone').then((done) => setFirstRun(!done));
  }, []);

  useEffect(() => {
    const unlisten = listen<string>(AppEvents.openSettingsSection, (event) => {
      const target = event.payload;
      if (SECTIONS.some((s) => s.id === target)) {
        setSection(target as SectionName);
      }
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => undefined);
    };
  }, []);

  if (firstRun === null) {
    return <main className="settings-root" aria-busy="true" />;
  }

  if (firstRun) {
    return (
      <main className="settings-root">
        <Onboarding onDone={() => setFirstRun(false)} />
      </main>
    );
  }

  return (
    <main className="settings-root">
      <nav className="settings-nav" aria-label="Settings sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={section === s.id ? 'nav-item nav-item-active' : 'nav-item'}
            aria-current={section === s.id ? 'page' : undefined}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {section === 'general' && <GeneralSection />}
        {section === 'pet' && <PetSection />}
        {section === 'ai' && <AiSection />}
        {section === 'data' && <DataSection />}
        {section === 'about' && <AboutSection />}
      </div>
    </main>
  );
}
