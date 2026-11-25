import { useCallback, useEffect, useState } from 'react';
import { Badge, Flex, IconButton, Spinner, Tabs, Tooltip } from '@radix-ui/themes';
import { ExitIcon } from '@radix-ui/react-icons';
import { adminApi, ApiError, type AdminState } from '../api';
import { PageShell } from '../shared/PageShell';
import { ErrorCallout } from '../shared/ErrorCallout';
import type { Appearance } from '../shared/useAppearance';
import { AdminLogin } from './AdminLogin';
import { ParticipantsTab } from './ParticipantsTab';
import { ExclusionsTab } from './ExclusionsTab';
import { DrawTab } from './DrawTab';
import { EventTab } from './EventTab';
import { CoAdminTab } from './CoAdminTab';

/** Führt eine Admin-Aktion aus. Liefert true, wenn sie geklappt hat. */
export type RunAction = (action: () => Promise<AdminState>) => Promise<boolean>;

interface AdminAppProps {
  appearance: Appearance;
  onToggleAppearance: () => void;
}

/**
 * Admin-Bereich unter /admin. Erreichbar mit ADMIN_PASSWORD (Hauptadmin) oder dem Co-Admin-Passwort.
 * Anders als bei den Teilnehmern übersteht die Anmeldung einen Reload; sie läuft nach 30 Minuten ohne Aktivität ab.
 */
export function AdminApp({ appearance, onToggleAppearance }: AdminAppProps) {
  const [loggedIn, setLoggedIn] = useState(adminApi.isLoggedIn());
  const [state, setState] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      adminApi.logout();
      setLoggedIn(false);
      setState(null);
      return;
    }
    setError(err instanceof ApiError ? err.message : 'Das hat nicht geklappt.');
  }, []);

  const load = useCallback(async () => {
    try {
      setState(await adminApi.state());
      setError(null);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    if (loggedIn) load();
  }, [loggedIn, load]);

  useEffect(() => {
    document.title = 'Admin · Wichtel-Glücksrad';
  }, []);

  const run: RunAction = useCallback(
    async (action) => {
      setError(null);
      try {
        setState(await action());
        return true;
      } catch (err) {
        handleError(err);
        return false;
      }
    },
    [handleError],
  );

  const logout = () => {
    adminApi.logout();
    setLoggedIn(false);
    setState(null);
  };

  const logoutButton = loggedIn && (
    <Tooltip content="Abmelden">
      <IconButton variant="soft" color="gray" onClick={logout} aria-label="Abmelden">
        <ExitIcon />
      </IconButton>
    </Tooltip>
  );

  return (
    <PageShell
      title={state ? `Admin · ${state.event.title}` : 'Admin'}
      size="2"
      appearance={appearance}
      onToggleAppearance={onToggleAppearance}
      actions={logoutButton}
    >
      {!loggedIn ? (
        <AdminLogin onLoggedIn={() => setLoggedIn(true)} />
      ) : !state ? (
        <Flex direction="column" gap="3" align="center" py="9">
          {error ? <ErrorCallout message={error} /> : <Spinner size="3" />}
        </Flex>
      ) : (
        <Flex direction="column" gap="4">
          <Summary state={state} />
          <ErrorCallout message={error} />
          <Tabs.Root defaultValue="participants">
            <Tabs.List wrap="wrap">
              <Tabs.Trigger value="participants">Personen</Tabs.Trigger>
              <Tabs.Trigger value="exclusions">Ausschlüsse</Tabs.Trigger>
              <Tabs.Trigger value="draw">Ziehung</Tabs.Trigger>
              <Tabs.Trigger value="event">Event</Tabs.Trigger>
              {state.role === 'main' && <Tabs.Trigger value="coadmin">Co-Admin</Tabs.Trigger>}
            </Tabs.List>
            <Tabs.Content value="participants">
              <ParticipantsTab state={state} run={run} />
            </Tabs.Content>
            <Tabs.Content value="exclusions">
              <ExclusionsTab state={state} run={run} />
            </Tabs.Content>
            <Tabs.Content value="draw">
              <DrawTab state={state} run={run} onError={handleError} />
            </Tabs.Content>
            <Tabs.Content value="event">
              <EventTab state={state} run={run} />
            </Tabs.Content>
            {state.role === 'main' && (
              <Tabs.Content value="coadmin">
                <CoAdminTab state={state} run={run} />
              </Tabs.Content>
            )}
          </Tabs.Root>
        </Flex>
      )}
    </PageShell>
  );
}

/** Kurzer Überblick über dem Inhalt. */
function Summary({ state }: { state: AdminState }) {
  const total = state.participants.length;
  const loggedIn = state.participants.filter((p) => p.firstLoginAt).length;
  const spun = state.assignments.filter((a) => a.spunAt).length;
  return (
    <Flex gap="2" wrap="wrap">
      {state.role === 'co' && (
        <Badge size="2" variant="solid" color="gray">
          Co-Admin
        </Badge>
      )}
      <Badge size="2" variant="soft" color={state.phase === 'open' ? 'green' : 'gray'}>
        {state.phase === 'open' ? 'Ziehung läuft' : 'Teilnehmer eintragen'}
      </Badge>
      <Badge size="2" variant="soft" color="gray">
        {total} Teilnehmer
      </Badge>
      <Badge size="2" variant="soft" color={loggedIn === total && total > 0 ? 'green' : 'gray'}>
        {loggedIn} von {total} angemeldet
      </Badge>
      {state.phase === 'open' && (
        <Badge size="2" variant="soft" color={spun === total ? 'green' : 'gray'}>
          {spun} von {total} gedreht
        </Badge>
      )}
    </Flex>
  );
}
