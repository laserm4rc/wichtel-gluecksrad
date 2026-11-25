import { useState } from 'react';
import { Badge, Button, Callout, Card, Flex, Heading, IconButton, Select, Text } from '@radix-ui/themes';
import { Cross2Icon, InfoCircledIcon, PlusIcon } from '@radix-ui/react-icons';
import { adminApi, type AdminParticipant, type AdminState } from '../api';
import type { RunAction } from './AdminApp';
import { ResetDrawButton } from './ResetDrawButton';

/** Ausschlüsse: Paare, die sich nicht gegenseitig ziehen dürfen. Änderbar nur vor der Ziehung. */
export function ExclusionsTab({ state, run }: { state: AdminState; run: RunAction }) {
  const locked = state.phase === 'open';
  const names = new Map(state.participants.map((p) => [p.id, p.name]));

  return (
    <Flex direction="column" gap="4" pt="4">
      <Text color="gray" size="2">
        Personen, die sich nicht gegenseitig ziehen sollen, z. B. Paare oder Geschwister. Das gilt in beide Richtungen.
      </Text>

      {locked && (
        <Callout.Root color="gray">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            Die Ziehung läuft schon. Um Ausschlüsse zu ändern, setze sie zurück, bearbeite die Ausschlüsse und starte neu.
          </Callout.Text>
        </Callout.Root>
      )}
      {locked && (
        <Flex>
          <ResetDrawButton run={run} />
        </Flex>
      )}

      {!locked && <AddExclusionForm state={state} run={run} />}

      <Card>
        <Flex direction="column" gap="3">
          <Heading as="h3" size="3">
            Festgelegte Ausschlüsse
          </Heading>
          {state.exclusions.length === 0 ? (
            <Text color="gray" size="2">
              Noch keine. Ohne Ausschlüsse kann jede Person jede andere ziehen (außer sich selbst).
            </Text>
          ) : (
            <Flex gap="2" wrap="wrap">
              {state.exclusions.map((ex) => (
                <Badge key={`${ex.a}-${ex.b}`} size="3" variant="surface" color="gray">
                  {names.get(ex.a)} ✕ {names.get(ex.b)}
                  {!locked && (
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="gray"
                      aria-label={`Ausschluss ${names.get(ex.a)} und ${names.get(ex.b)} aufheben`}
                      onClick={() => run(() => adminApi.removeExclusion(ex.a, ex.b))}
                    >
                      <Cross2Icon />
                    </IconButton>
                  )}
                </Badge>
              ))}
            </Flex>
          )}
        </Flex>
      </Card>
    </Flex>
  );
}

function AddExclusionForm({ state, run }: { state: AdminState; run: RunAction }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  if (state.participants.length < 2) {
    return (
      <Text color="gray" size="2">
        Lege zuerst mindestens zwei Personen an.
      </Text>
    );
  }

  const add = async () => {
    if (!a || !b || a === b) return;
    if (await run(() => adminApi.addExclusion(Number(a), Number(b)))) {
      setA('');
      setB('');
    }
  };

  return (
    <Card>
      <Flex direction="column" gap="3">
        <Heading as="h3" size="3">
          Ausschluss hinzufügen
        </Heading>
        <Flex gap="2" wrap="wrap" align="center">
          <PersonSelect value={a} onChange={setA} participants={state.participants.filter((p) => String(p.id) !== b)} />
          <Text color="gray">✕</Text>
          <PersonSelect value={b} onChange={setB} participants={state.participants.filter((p) => String(p.id) !== a)} />
          <Button onClick={add} disabled={!a || !b || a === b}>
            <PlusIcon /> Ausschließen
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}

function PersonSelect({
  value,
  onChange,
  participants,
}: {
  value: string;
  onChange: (value: string) => void;
  participants: AdminParticipant[];
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger placeholder="Person wählen" />
      <Select.Content>
        {participants.map((p) => (
          <Select.Item key={p.id} value={String(p.id)}>
            {p.name}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
