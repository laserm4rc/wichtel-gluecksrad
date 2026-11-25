import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Box, Button, Card, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { CheckIcon, ClockIcon, LockOpen1Icon } from '@radix-ui/react-icons';
import { adminApi, type AdminState } from '../api';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { formatDateTimeLong } from '../shared/format';
import type { RunAction } from './AdminApp';

/** ISO-Zeitstempel → Wert für ein datetime-local-Feld ("YYYY-MM-DDTHH:mm") in der Event-Zeitzone. */
function toLocalInput(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  // Das schwedische Format ist zufällig genau "YYYY-MM-DD HH:mm"
  return new Date(iso)
    .toLocaleString('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(' ', 'T');
}

/**
 * Anmeldestart: Vor diesem Zeitpunkt können sich Teilnehmer nicht anmelden,
 * auch wenn die Ziehung schon läuft. Die Anmeldeseite zeigt Datum und Uhrzeit an.
 */
export function LoginOpensCard({ state, run }: { state: AdminState; run: RunAction }) {
  const { login } = state;
  const [value, setValue] = useState(() => toLocalInput(login.opensAt, login.timeZone));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(toLocalInput(login.opensAt, login.timeZone)), [login.opensAt, login.timeZone]);

  const changed = value !== toLocalInput(login.opensAt, login.timeZone);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!value) return;
    setBusy(true);
    const ok = await run(() => adminApi.setLoginOpensAt(value));
    setBusy(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <Card>
      <form onSubmit={save}>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center" gap="2" wrap="wrap">
            <Heading as="h3" size="3">
              Anmeldung freischalten ab
            </Heading>
            <Badge color={login.open ? 'green' : 'orange'} variant="soft">
              {login.open ? 'Anmeldung offen' : 'Anmeldung gesperrt'}
            </Badge>
          </Flex>

          <Text size="2" color="gray">
            Vor diesem Zeitpunkt kann sich niemand anmelden, auch wenn die Ziehung schon läuft. Die Anmeldeseite zeigt Datum und
            Uhrzeit an und schaltet sich dann von selbst frei.
          </Text>

          {login.opensAt && (
            <Flex align="center" gap="2">
              <ClockIcon />
              <Text size="2">
                {login.open ? 'Freigeschaltet seit' : 'Freigeschaltet ab'} <Text weight="bold">{formatDateTimeLong(login.opensAt, login.timeZone)}</Text>
              </Text>
            </Flex>
          )}
          {!login.opensAt && (
            <Text size="2">Kein Zeitpunkt gesetzt: Anmelden ist sofort möglich.</Text>
          )}

          <Flex gap="2" wrap="wrap" align="center">
            <Box flexGrow="1" flexBasis="220px">
              <TextField.Root
                type="datetime-local"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label="Anmeldung freischalten ab (Datum und Uhrzeit)"
              />
            </Box>
            <Button type="submit" loading={busy} disabled={!value || !changed} color={saved ? 'green' : undefined}>
              {saved ? (
                <>
                  <CheckIcon /> Gespeichert
                </>
              ) : (
                'Speichern'
              )}
            </Button>
            {login.opensAt && (
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="soft" color="gray">
                    <LockOpen1Icon /> Sofort freigeben
                  </Button>
                }
                title="Anmeldung sofort freigeben?"
                description="Der Zeitpunkt wird entfernt. Alle können sich ab jetzt anmelden und drehen, sobald die Ziehung läuft."
                confirmLabel="Freigeben"
                color="green"
                onConfirm={() => run(() => adminApi.setLoginOpensAt(null))}
              />
            )}
          </Flex>
          <Text size="1" color="gray">
            Zeitzone: {login.timeZone}
          </Text>
        </Flex>
      </form>
    </Card>
  );
}
