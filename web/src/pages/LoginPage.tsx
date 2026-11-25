import { useState, type FormEvent } from 'react';
import { Button, Card, Flex, Text, TextField } from '@radix-ui/themes';
import { LockClosedIcon } from '@radix-ui/react-icons';
import { api, ApiError } from '../api';
import { ErrorCallout } from '../shared/ErrorCallout';

interface LoginPageProps {
  onLoggedIn: () => void;
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
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
              Willkommen beim Wichteln!
            </Text>
            <Text as="p" color="gray">
              Melde dich mit dem Passwort an, das du bekommen hast.
            </Text>
          </Flex>

          <TextField.Root
            size="3"
            placeholder="z. B. tanne-zimt-472"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Passwort"
            autoFocus
          >
            <TextField.Slot>
              <LockClosedIcon />
            </TextField.Slot>
          </TextField.Root>

          <ErrorCallout message={error} />

          <Button size="3" type="submit" loading={busy} disabled={!password.trim()}>
            Anmelden
          </Button>
        </Flex>
      </form>
    </Card>
  );
}
