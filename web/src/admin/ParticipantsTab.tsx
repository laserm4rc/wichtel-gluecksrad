import { useState, type FormEvent } from 'react';
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Code,
  DropdownMenu,
  Flex,
  Heading,
  IconButton,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes';
import {
  ChatBubbleIcon,
  DotsHorizontalIcon,
  EnvelopeClosedIcon,
  InfoCircledIcon,
  PlusIcon,
  ReloadIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { adminApi, type AdminParticipant, type AdminState } from '../api';
import { CopyButton } from '../shared/CopyButton';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { formatTimestamp } from '../shared/format';
import type { RunAction } from './AdminApp';
import { ResetDrawButton } from './ResetDrawButton';

interface TabProps {
  state: AdminState;
  run: RunAction;
}

export function ParticipantsTab({ state, run }: TabProps) {
  const locked = state.phase === 'open';
  return (
    <Flex direction="column" gap="5" pt="4">
      {locked && (
        <Callout.Root color="gray">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            Die Ziehung läuft. Personen lassen sich erst wieder hinzufügen oder entfernen, wenn die Ziehung zurückgesetzt ist.
            Passwörter kannst du jederzeit neu vergeben.
          </Callout.Text>
        </Callout.Root>
      )}
      {locked && (
        <Flex>
          <ResetDrawButton run={run} />
        </Flex>
      )}

      {!locked && <AddParticipantForm run={run} />}

      <Flex direction="column" gap="2">
        {state.participants.length === 0 ? (
          <Text color="gray">Noch niemand eingetragen.</Text>
        ) : (
          state.participants.map((p) => <ParticipantCard key={p.id} participant={p} state={state} run={run} />)
        )}
      </Flex>

    </Flex>
  );
}

function AddParticipantForm({ run }: { run: RunAction }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const ok = await run(() => adminApi.addParticipant(name.trim(), password.trim() || undefined));
    setBusy(false);
    if (ok) {
      setName('');
      setPassword('');
    }
  };

  return (
    <Card>
      <form onSubmit={submit}>
        <Flex direction="column" gap="3">
          <Heading as="h3" size="3">
            Person hinzufügen
          </Heading>
          <Flex gap="2" wrap="wrap">
            <Box flexGrow="1" flexBasis="160px">
              <TextField.Root placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
            </Box>
            <Box flexGrow="1" flexBasis="200px">
              <TextField.Root
                placeholder="Passwort (leer = automatisch)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Passwort, optional"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Box>
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              <PlusIcon /> Hinzufügen
            </Button>
          </Flex>
        </Flex>
      </form>
    </Card>
  );
}

function inviteText(p: AdminParticipant, state: AdminState) {
  const url = state.baseUrl || window.location.origin;
  return `Hallo ${p.name}! 🎄\nHier ziehst du deinen Wichtelpartner für „${state.event.title}“:\n${url}\nDein Passwort: ${p.password}`;
}

function ParticipantCard({ participant: p, state, run }: { participant: AdminParticipant; state: AdminState; run: RunAction }) {
  const locked = state.phase === 'open';
  const invite = inviteText(p, state);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(invite)}`;

  return (
    <Card>
      <Flex direction="column" gap="2">
        <Flex justify="between" align="center" gap="2" wrap="wrap">
          <Text weight="bold" size="3">
            {p.name}
          </Text>
          <Flex gap="2" wrap="wrap">
            <LoginBadge participant={p} />
            {locked && (
              <Badge color={p.spunAt ? 'green' : 'orange'} variant="soft">
                {p.spunAt ? `gedreht ${formatTimestamp(p.spunAt)}` : 'noch nicht gedreht'}
              </Badge>
            )}
          </Flex>
        </Flex>

        <Flex justify="between" align="center" gap="2" wrap="wrap">
          <Code size="3" variant="ghost">
            {p.password}
          </Code>
          <Flex gap="2">
            <CopyButton text={p.password} label="Passwort kopieren" />
            <CopyButton text={invite} label="Einladung kopieren (Link + Passwort)" icon={<EnvelopeClosedIcon />} />
            <Tooltip content="Per WhatsApp schicken">
              <IconButton asChild variant="soft" color="green" aria-label="Per WhatsApp schicken">
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  <ChatBubbleIcon />
                </a>
              </IconButton>
            </Tooltip>
            <ParticipantMenu participant={p} locked={locked} run={run} />
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

/** Zeigt, ob die Person ihr Passwort schon benutzt hat. */
function LoginBadge({ participant: p }: { participant: AdminParticipant }) {
  if (!p.firstLoginAt) {
    return (
      <Badge color="gray" variant="soft">
        Passwort noch nicht benutzt
      </Badge>
    );
  }
  const details =
    p.loginCount > 1
      ? `Erste Anmeldung ${formatTimestamp(p.firstLoginAt)}, zuletzt ${formatTimestamp(p.lastLoginAt)}`
      : `Angemeldet am ${formatTimestamp(p.firstLoginAt)}`;
  return (
    <Tooltip content={details}>
      <Badge color="green" variant="soft">
        angemeldet {p.loginCount}× · zuletzt {formatTimestamp(p.lastLoginAt)}
      </Badge>
    </Tooltip>
  );
}

function ParticipantMenu({ participant: p, locked, run }: { participant: AdminParticipant; locked: boolean; run: RunAction }) {
  const [dialog, setDialog] = useState<'password' | 'remove' | null>(null);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton variant="soft" color="gray" aria-label={`Weitere Aktionen für ${p.name}`}>
            <DotsHorizontalIcon />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item onSelect={() => setDialog('password')}>
            <ReloadIcon /> Neues Passwort
          </DropdownMenu.Item>
          <DropdownMenu.Item color="red" disabled={locked} onSelect={() => setDialog('remove')}>
            <TrashIcon /> Entfernen
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {/* Dialoge außerhalb des Menüs, damit sie offen bleiben, wenn sich das Menü schließt */}
      {dialog === 'password' && (
        <ControlledConfirm
          title={`Neues Passwort für ${p.name}?`}
          description="Das alte Passwort funktioniert danach nicht mehr. Die Zuteilung bleibt gleich."
          confirmLabel="Neues Passwort"
          color="green"
          onConfirm={() => run(() => adminApi.resetPassword(p.id))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'remove' && (
        <ControlledConfirm
          title={`${p.name} entfernen?`}
          description="Die Person und ihre Ausschlüsse werden gelöscht."
          confirmLabel="Entfernen"
          onConfirm={() => run(() => adminApi.removeParticipant(p.id))}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/** ConfirmDialog, der sofort offen ist (für Aktionen aus einem Menü). */
function ControlledConfirm(props: {
  title: string;
  description: string;
  confirmLabel: string;
  color?: 'red' | 'green';
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && props.onClose()}
      title={props.title}
      description={props.description}
      confirmLabel={props.confirmLabel}
      color={props.color}
      onConfirm={props.onConfirm}
    />
  );
}
