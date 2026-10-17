import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { useStore } from '../store/store';
import { AddScreen } from './AddScreen';
import { useHashRoute } from './common';
import { ItemsScreen } from './ItemsScreen';
import { Onboarding } from './Onboarding';
import { RailsScreen } from './RailsScreen';
import { SettingsScreen } from './SettingsScreen';
import { SortScreen } from './SortScreen';

const TABS = [
  { path: '/rails', label: 'Rails', icon: '▤' },
  { path: '/sort', label: 'Sort', icon: '⇅' },
  { path: '/add', label: 'Add', icon: '＋' },
  { path: '/items', label: 'Items', icon: '☰' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

const DAY = 86_400_000;

export function App() {
  const { data, ready, saveError } = useStore();
  const route = useHashRoute();
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = data.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }, [data.settings.theme]);

  if (!ready) return <p class="loading">Loading…</p>;

  const staleBackup =
    data.items.length > 0 &&
    (!data.settings.lastBackupDate || Date.now() - Date.parse(data.settings.lastBackupDate) > 30 * DAY);

  if (!data.settings.onboarded && data.items.length === 0) return <main><Onboarding /></main>;

  const [, top, arg] = route.split('/');
  let screen;
  switch (top) {
    case 'sort': screen = <SortScreen categoryId={arg} />; break;
    case 'add': screen = <AddScreen />; break;
    case 'edit': screen = <AddScreen key={arg} editId={arg} />; break;
    case 'items': screen = <ItemsScreen />; break;
    case 'settings': screen = <SettingsScreen />; break;
    default: screen = <RailsScreen />;
  }
  const active = top === 'edit' ? 'items' : top;

  return (
    <>
      {needRefresh && !dismissed && (
        <div class="update" role="status">
          New version available.
          <button onClick={() => updateServiceWorker(true)}>Reload</button>
          <button class="ghost" onClick={() => setDismissed(true)}>Later</button>
        </div>
      )}
      {saveError && <div class="update warn-bar" role="alert">{saveError}</div>}
      <main>
        {staleBackup && top !== 'settings' && (
          <p class="banner">It's been a while since your last backup. <a href="#/settings">Export one</a>.</p>
        )}
        {screen}
      </main>
      <nav class="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} class={`tab ${active === t.path.slice(1) ? 'active' : ''} ${t.label === 'Add' ? 'add' : ''}`} aria-current={active === t.path.slice(1) ? 'page' : undefined}>
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
