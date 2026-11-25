import { useState, type FormEvent } from 'react';
import { Button, Card, Flex, Text, TextField } from '@radix-ui/themes';
import { LockClosedIcon } from '@radix-ui/react-icons';
import { adminApi, ApiError } from '../api';
import { ErrorCallout } from '../shared/ErrorCallout';

export function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anmeldung fehlgeschlagen.');
      setBusy(false);
    }
  };

  return (
    <Card size="3">
      <form onSubmit={submit}>
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="1">
            <Text as="p" size="4" weight="bold">
              Admin-Bereich
            </Text>
            <Text as="p" color="gray">
              Nur für die Organisation. Melde dich mit dem Admin-Passwort an.
            </Text>
          </Flex>
          <TextField.Root
            size="3"
            type="password"
            placeholder="Admin-Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-label="Admin-Passwort"
            autoFocus
          >
            <TextField.Slot>
              <LockClosedIcon />
            </TextField.Slot>
          </TextField.Root>
          <ErrorCallout message={error} />
          <Button size="3" type="submit" loading={busy} disabled={!password}>
            Anmelden
          </Button>
        </Flex>
      </form>
    </Card>
  );
}
