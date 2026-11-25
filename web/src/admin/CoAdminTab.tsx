import { useState, type FormEvent } from 'react';
import { Badge, Box, Button, Callout, Card, Code, Flex, Heading, RadioCards, Text, TextField } from '@radix-ui/themes';
import { CheckCircledIcon, EyeClosedIcon, EyeNoneIcon, InfoCircledIcon, TrashIcon } from '@radix-ui/react-icons';
import { adminApi, type AdminState, type CoAdminVisibility } from '../api';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { CopyButton } from '../shared/CopyButton';
import type { RunAction } from './AdminApp';

/**
 * Nur für den Hauptadmin: zweiten Admin anlegen und festlegen, was er von der Zuteilung sieht.
 * Das Passwort wird nur gehasht gespeichert und deshalb nur einmal direkt nach dem Erzeugen angezeigt.
 */
export function CoAdminTab({ state, run }: { state: AdminState; run: RunAction }) {
  const coAdmin = state.coAdmin;
  const [shownPassword, setShownPassword] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  if (!coAdmin) return null;

  const setPassword = async (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    let created: string | undefined;
    const ok = await run(async () => {
      const result = await adminApi.setCoAdminPassword(custom.trim() || undefined);
      created = result.newCoAdminPassword;
      return result;
    });
    setBusy(false);
    if (ok && created) {
      setShownPassword(created);
      setCustom('');
    }
  };

  const loginUrl = `${state.baseUrl || window.location.origin}/admin`;

  return (
    <Flex direction="column" gap="4" pt="4">
      <Text color="gray" size="2">
        Ein zweiter Admin kann alles, was du auch kannst: Personen, Passwörter, Ausschlüsse, Ziehung und Event. Nur diesen
        Reiter sieht er nicht. Von der Zuteilung sieht er so viel, wie du hier einstellst.
      </Text>

      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center" gap="2" wrap="wrap">
            <Heading as="h3" size="3">
              Zugang
            </Heading>
            <Badge color={coAdmin.enabled ? 'green' : 'gray'} variant="soft">
              {coAdmin.enabled ? 'Co-Admin aktiv' : 'Kein Co-Admin'}
            </Badge>
          </Flex>

          {shownPassword && (
            <Callout.Root color="green">
              <Callout.Icon>
                <CheckCircledIcon />
              </Callout.Icon>
              <Flex direction="column" gap="2">
                <Callout.Text>
                  Neues Co-Admin-Passwort. Es wird nur jetzt angezeigt, kopiere es gleich. Anmelden kann er sich unter{' '}
                  <Code variant="ghost">{loginUrl}</Code>.
                </Callout.Text>
                <Flex align="center" gap="2" wrap="wrap">
                  <Code size="3">{shownPassword}</Code>
                  <CopyButton text={shownPassword} label="Passwort kopieren" />
                  <CopyButton
                    text={`Admin-Zugang Wichteln: ${loginUrl}\nPasswort: ${shownPassword}`}
                    label="Link und Passwort kopieren"
                  />
                </Flex>
              </Flex>
            </Callout.Root>
          )}

          <form onSubmit={setPassword}>
            <Flex gap="2" wrap="wrap" align="end">
              <Box flexGrow="1" flexBasis="220px">
                <TextField.Root
                  placeholder="Eigenes Passwort (leer = automatisch)"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  aria-label="Eigenes Co-Admin-Passwort, optional"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Box>
              <Button type="submit" loading={busy}>
                {coAdmin.enabled ? 'Neues Passwort' : 'Co-Admin anlegen'}
              </Button>
            </Flex>
          </form>
          {coAdmin.enabled && (
            <Text size="1" color="gray">
              Ein neues Passwort meldet den Co-Admin sofort ab.
            </Text>
          )}
        </Flex>
      </Card>

      <Card>
        <Flex direction="column" gap="3">
          <Heading as="h3" size="3">
            Was sieht der Co-Admin von der Zuteilung?
          </Heading>
          <RadioCards.Root
            value={coAdmin.visibility}
            onValueChange={(value) => run(() => adminApi.setCoAdminVisibility(value as CoAdminVisibility))}
            columns={{ initial: '1', sm: '2' }}
          >
            <RadioCards.Item value="hidden">
              <Flex direction="column" gap="1" width="100%">
                <Flex align="center" gap="2">
                  <EyeNoneIcon />
                  <Text weight="bold">Gar nichts</Text>
                </Flex>
                <Text size="2" color="gray">
                  Er sieht nur, wer schon gedreht hat. Kein Aufdecken, kein CSV-Export.
                </Text>
              </Flex>
            </RadioCards.Item>
            <RadioCards.Item value="covered">
              <Flex direction="column" gap="1" width="100%">
                <Flex align="center" gap="2">
                  <EyeClosedIcon />
                  <Text weight="bold">Verdeckt</Text>
                </Flex>
                <Text size="2" color="gray">
                  Namen sind verdeckt und lassen sich einzeln oder alle aktiv aufdecken.
                </Text>
              </Flex>
            </RadioCards.Item>
          </RadioCards.Root>
          <Text size="1" color="gray">
            Gilt sofort, auch wenn der Co-Admin gerade angemeldet ist.
          </Text>
        </Flex>
      </Card>

      <Callout.Root color="orange">
        <Callout.Icon>
          <InfoCircledIcon />
        </Callout.Icon>
        <Callout.Text>
          Der Co-Admin sieht die Passwörter der Teilnehmer, damit er Einladungen verschicken kann. Theoretisch könnte er sich
          damit als jemand anderes anmelden und drehen. Ob jemand sein Passwort benutzt hat, siehst du im Reiter „Personen“.
        </Callout.Text>
      </Callout.Root>

      {coAdmin.enabled && (
        <Flex>
          <ConfirmDialog
            trigger={
              <Button variant="soft" color="red">
                <TrashIcon /> Co-Admin entfernen
              </Button>
            }
            title="Co-Admin entfernen?"
            description="Sein Passwort funktioniert danach nicht mehr und er wird sofort abgemeldet."
            confirmLabel="Entfernen"
            onConfirm={async () => {
              if (await run(adminApi.removeCoAdmin)) setShownPassword(null);
            }}
          />
        </Flex>
      )}
    </Flex>
  );
}
