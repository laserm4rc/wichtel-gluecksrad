import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { CheckIcon } from '@radix-ui/react-icons';
import { adminApi, type AdminState, type EventInfo } from '../api';
import type { RunAction } from './AdminApp';
import { LoginOpensCard } from './LoginOpensCard';

const FIELDS: { key: keyof EventInfo; label: string; placeholder: string }[] = [
  { key: 'title', label: 'Titel', placeholder: 'z. B. Wichteln 2026' },
  { key: 'budget', label: 'Budget', placeholder: 'z. B. 25 €' },
  { key: 'date', label: 'Datum', placeholder: 'z. B. Fr, 19.12., 18 Uhr' },
  { key: 'location', label: 'Ort', placeholder: 'z. B. bei Anna' },
];

/** Event-Infos. Sie erscheinen auf der Teilnehmerseite unter dem gezogenen Namen. */
export function EventTab({ state, run }: { state: AdminState; run: RunAction }) {
  const [values, setValues] = useState<EventInfo>(state.event);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValues(state.event), [state.event]);

  const changed = FIELDS.some(({ key }) => values[key] !== state.event[key]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const ok = await run(() => adminApi.saveEvent(values));
    setBusy(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <Flex direction="column" gap="4" pt="4">
      <LoginOpensCard state={state} run={run} />
      <Card>
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <Heading as="h3" size="3">
              Event-Infos
            </Heading>
            {FIELDS.map(({ key, label, placeholder }) => (
              <label key={key}>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">
                    {label}
                  </Text>
                  <TextField.Root
                    value={values[key]}
                    placeholder={placeholder}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  />
                </Flex>
              </label>
            ))}
            <Flex justify="end">
              <Button type="submit" loading={busy} disabled={!changed || !values.title.trim()} color={saved ? 'green' : undefined}>
                {saved ? (
                  <>
                    <CheckIcon /> Gespeichert
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Card>
    </Flex>
  );
}
