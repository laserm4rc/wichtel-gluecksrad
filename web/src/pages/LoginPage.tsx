import { useEffect, useState, type FormEvent } from 'react';
import { Button, Callout, Card, Flex, Strong, Text, TextField } from '@radix-ui/themes';
import { ClockIcon, LockClosedIcon } from '@radix-ui/react-icons';
import { api, ApiError, type LoginInfo } from '../api';
import { ErrorCallout } from '../shared/ErrorCallout';
import { formatCountdown, formatDateTimeLong } from '../shared/format';

interface LoginPageProps {
  login: LoginInfo;
  onLoggedIn: () => void;
  /** Wird aufgerufen, sobald der Anmeldestart erreicht ist, damit die Seite den Stand neu lädt */
  onOpened: () => void;
}

export function LoginPage({ login, onLoggedIn, onOpened }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = useRemaining(login.open ? null : login.opensAt, onOpened);
  const closed = !login.open && login.opensAt !== null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim() || closed) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anmeldung fehlgeschlagen.');
      setBusy(false);
      // Falls der Admin den Start gerade verschoben hat, den aktuellen Stand holen
      if (err instanceof ApiError && err.status === 403) onOpened();
    }
  };

  return (
    <Card size="3">
      <form onSubmit={submit}>
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="1">
            <Text as="p" size="4" weight="bold">
              Willkommen beim Wichteln!
            </Text>
            <Text as="p" color="gray">
              {closed ? 'Bald kannst du dich hier mit deinem Passwort anmelden.' : 'Melde dich mit dem Passwort an, das du bekommen hast.'}
            </Text>
          </Flex>

          {closed && login.opensAt && (
            <Callout.Root color="green" size="2">
              <Callout.Icon>
                <ClockIcon />
              </Callout.Icon>
              <Flex direction="column" gap="1">
                <Callout.Text>
                  Die Anmeldung startet am <Strong>{formatDateTimeLong(login.opensAt, login.timeZone)}</Strong>.
                </Callout.Text>
                {remaining !== null && (
                  <Callout.Text size="2">Das ist in {formatCountdown(remaining)}.</Callout.Text>
                )}
              </Flex>
            </Callout.Root>
          )}

          <TextField.Root
            size="3"
            color="green"
            placeholder="z. B. tanne-zimt-472"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Passwort"
            disabled={closed}
            autoFocus={!closed}
          >
            <TextField.Slot>
              <LockClosedIcon />
            </TextField.Slot>
          </TextField.Root>

          <ErrorCallout message={error} />

          <Button size="3" type="submit" color="green" loading={busy} disabled={closed || !password.trim()}>
            {closed ? 'Noch nicht freigeschaltet' : 'Anmelden'}
          </Button>
        </Flex>
      </form>
    </Card>
  );
}

/**
 * Restzeit bis `opensAt` in Millisekunden, aktualisiert sich jede Sekunde.
 * Ist der Zeitpunkt erreicht, wird `onReached` aufgerufen, danach alle 5 Sekunden erneut,
 * bis der Server freigibt (die Uhr des Handys kann etwas vorgehen). Die Freigabe prüft der Server.
 */
function useRemaining(opensAt: string | null, onReached: () => void): number | null {
  const target = opensAt ? new Date(opensAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target === null) return;
    let lastCheck = 0;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= target && current - lastCheck >= 5000) {
        lastCheck = current;
        onReached();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [target, onReached]);

  return target === null ? null : Math.max(0, target - now);
}
