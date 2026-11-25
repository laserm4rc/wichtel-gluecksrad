import { useCallback, useEffect, useState } from 'react';
import { Button, Flex, IconButton, Spinner, Theme, Tooltip } from '@radix-ui/themes';
import { ExitIcon } from '@radix-ui/react-icons';
import { api, ApiError, type Session, type SessionUser } from './api';
import { PageShell } from './shared/PageShell';
import { ErrorCallout } from './shared/ErrorCallout';
import { useAppearance, type Appearance } from './shared/useAppearance';
import { LoginPage } from './pages/LoginPage';
import { WheelPage } from './pages/WheelPage';
import { AdminApp } from './admin/AdminApp';

/** Das einzige <Theme> der App: Farben, Rundung und Skalierung werden nur hier eingestellt. */
export function App() {
  const { appearance, toggle } = useAppearance();
  const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';
  return (
    <Theme appearance={appearance} accentColor="red" grayColor="sand" radius="large" scaling="100%">
      {isAdmin ? (
        <AdminApp appearance={appearance} onToggleAppearance={toggle} />
      ) : (
        <ParticipantApp appearance={appearance} onToggleAppearance={toggle} />
      )}
    </Theme>
  );
}

function ParticipantApp({ appearance, onToggleAppearance }: { appearance: Appearance; onToggleAppearance: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSession(await api.session());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Die Seite konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (session?.event.title) document.title = session.event.title;
  }, [session?.event.title]);

  const logout = () => {
    api.logout();
    load();
  };

  const user = session?.user;
  const logoutButton = user && (
    <Tooltip content="Abmelden">
      <IconButton variant="soft" color="gray" onClick={logout} aria-label="Abmelden">
        <ExitIcon />
      </IconButton>
    </Tooltip>
  );

  return (
    <PageShell
      title={session?.event.title ?? 'Wichteln'}
      appearance={appearance}
      onToggleAppearance={onToggleAppearance}
      actions={logoutButton}
    >
      {error ? (
        <Flex direction="column" gap="3">
          <ErrorCallout message={error} />
          <Button variant="soft" onClick={load}>
            Erneut versuchen
          </Button>
        </Flex>
      ) : !session ? (
        <Flex justify="center" py="9">
          <Spinner size="3" />
        </Flex>
      ) : user ? (
        <WheelPage key={user.name} session={session as Session & { user: SessionUser }} onRefresh={load} />
      ) : (
        <LoginPage login={session.login} onLoggedIn={load} onOpened={load} />
      )}
    </PageShell>
  );
}
