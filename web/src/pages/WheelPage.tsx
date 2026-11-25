import { useState } from 'react';
import { Badge, Button, Callout, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { InfoCircledIcon, ReloadIcon } from '@radix-ui/react-icons';
import { ErrorCallout } from '../shared/ErrorCallout';
import { api, ApiError, type Session, type SessionUser } from '../api';
import { Wheel } from '../wheel/Wheel';

interface WheelPageProps {
  session: Session & { user: SessionUser };
  onRefresh: () => void;
}

type Stage = 'ready' | 'spinning' | 'done';

export function WheelPage({ session, onRefresh }: WheelPageProps) {
  const { user, phase, event } = session;
  // Bei jedem Besuch startet das Rad neu: Das Ergebnis erscheint erst nach dem Drehen
  const [result, setResult] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('ready');
  const [spinKey, setSpinKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const spin = async () => {
    setError(null);
    setStage('spinning');
    try {
      const { receiver } = await api.spin();
      setResult(receiver);
      setSpinKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Das hat nicht geklappt.');
      setStage('ready');
      // 409: Ziehung noch nicht gestartet, 401: Anmeldung abgelaufen -> Seite neu laden lassen
      if (err instanceof ApiError && (err.status === 409 || err.status === 401)) onRefresh();
    }
  };

  const onSpinEnd = () => {
    setStage('done');
    navigator.vibrate?.(80);
  };

  return (
    <Flex direction="column" gap="5">
      <Text as="p" size="3">
        Hallo <Text weight="bold">{user.name}</Text>!{' '}
        {phase === 'setup'
          ? 'Gleich geht’s los.'
          : stage === 'done'
            ? 'Dein Wichtelpartner steht fest.'
            : user.spun
              ? 'Dreh nochmal, um deinen Wichtelpartner wieder zu sehen.'
              : 'Dreh am Rad und finde heraus, wen du beschenkst.'}
      </Text>

      <Wheel
        names={user.wheel}
        target={result}
        spinKey={spinKey}
        idle={phase === 'setup'}
        onSpinEnd={onSpinEnd}
      />

      <ErrorCallout message={error} />

      {phase === 'setup' && (
        <Flex direction="column" gap="3">
          <Callout.Root color="gray">
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>Die Ziehung ist noch nicht gestartet. Schau etwas später noch einmal vorbei.</Callout.Text>
          </Callout.Root>
          <Button size="3" variant="soft" onClick={onRefresh}>
            <ReloadIcon /> Nochmal prüfen
          </Button>
        </Flex>
      )}

      {phase === 'open' && stage !== 'done' && (
        <Button size="4" onClick={spin} loading={stage === 'spinning'}>
          Drehen!
        </Button>
      )}

      {phase === 'open' && stage === 'done' && result && (
        <Card size="3">
          <Flex direction="column" align="center" gap="2">
            <Text color="gray">Du beschenkst</Text>
            <Heading as="h2" size="8" align="center" color="red" highContrast>
              {result}
            </Heading>
            {(event.budget || event.date || event.location) && (
              <Flex gap="2" wrap="wrap" justify="center">
                {event.budget && (
                  <Badge size="2" variant="soft" color="gray">
                    Budget: {event.budget}
                  </Badge>
                )}
                {event.date && (
                  <Badge size="2" variant="soft" color="gray">
                    {event.date}
                  </Badge>
                )}
                {event.location && (
                  <Badge size="2" variant="soft" color="gray">
                    {event.location}
                  </Badge>
                )}
              </Flex>
            )}
            <Text size="2" color="gray" align="center">
              Pssst, nicht verraten!
            </Text>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}
