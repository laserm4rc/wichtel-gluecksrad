import { useState } from 'react';
import { Badge, Button, Callout, Card, Flex, IconButton, Separator, Text, Tooltip } from '@radix-ui/themes';
import {
  ArrowRightIcon,
  DownloadIcon,
  EyeClosedIcon,
  EyeNoneIcon,
  EyeOpenIcon,
  InfoCircledIcon,
  PlayIcon,
  ShuffleIcon,
} from '@radix-ui/react-icons';
import { adminApi, type AdminAssignment, type AdminState } from '../api';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { formatTimestamp } from '../shared/format';
import type { RunAction } from './AdminApp';
import { ResetDrawButton } from './ResetDrawButton';

interface DrawTabProps {
  state: AdminState;
  run: RunAction;
  onError: (err: unknown) => void;
}

export function DrawTab({ state, run, onError }: DrawTabProps) {
  if (state.phase === 'setup') return <StartDraw state={state} run={run} />;
  return <RunningDraw state={state} run={run} onError={onError} />;
}

function StartDraw({ state, run }: { state: AdminState; run: RunAction }) {
  const enough = state.participants.length >= 2;
  return (
    <Flex direction="column" gap="4" pt="4">
      <Callout.Root color="gray">
        <Callout.Icon>
          <InfoCircledIcon />
        </Callout.Icon>
        <Callout.Text>
          Beim Start wird die komplette Zuteilung auf einmal berechnet: Niemand zieht sich selbst, Ausschlüsse werden beachtet.
          Danach kann jede Person drehen und sieht ihren Namen.
        </Callout.Text>
      </Callout.Root>
      <ConfirmDialog
        trigger={
          <Button size="3" disabled={!enough}>
            <PlayIcon /> Ziehung starten
          </Button>
        }
        title="Ziehung starten?"
        description={`Die Zuteilung für ${state.participants.length} Personen wird jetzt festgelegt. Danach lassen sich Personen und Ausschlüsse erst nach einem Zurücksetzen wieder ändern.`}
        confirmLabel="Starten"
        color="green"
        onConfirm={() => run(adminApi.startDraw)}
      />
      {!enough && (
        <Text size="2" color="gray">
          Dafür braucht es mindestens 2 Teilnehmer.
        </Text>
      )}
    </Flex>
  );
}

/** Aufgedeckte Namen gelten nur für die Auslosung, in der sie aufgedeckt wurden. */
interface Revealed {
  drawId: string | null;
  names: Map<number, string>;
}

function RunningDraw({ state, run, onError }: DrawTabProps) {
  const visibility = state.assignmentsVisibility;
  const [revealed, setRevealed] = useState<Revealed>({ drawId: null, names: new Map() });
  const [downloading, setDownloading] = useState(false);
  // Nach einem Neu-Auslosen (neue drawId) ist automatisch alles wieder verdeckt
  const revealedNames = revealed.drawId === state.drawId ? revealed.names : new Map<number, string>();

  const reveal = async (giverId?: number) => {
    try {
      const result = await adminApi.reveal(giverId);
      const names = new Map(result.drawId === revealed.drawId ? revealed.names : []);
      for (const a of result.assignments) names.set(a.giverId, a.receiver);
      setRevealed({ drawId: result.drawId, names });
    } catch (err) {
      onError(err);
    }
  };

  const cover = (giverId?: number) => {
    const names = new Map(revealedNames);
    if (giverId === undefined) names.clear();
    else names.delete(giverId);
    setRevealed({ drawId: state.drawId, names });
  };

  const download = async () => {
    setDownloading(true);
    try {
      await adminApi.downloadCsv();
    } catch (err) {
      onError(err);
    }
    setDownloading(false);
  };

  const allRevealed = state.assignments.every((a) => revealedNames.has(a.giverId));

  return (
    <Flex direction="column" gap="4" pt="4">
      {visibility === 'hidden' && (
        <Callout.Root color="gray">
          <Callout.Icon>
            <EyeNoneIcon />
          </Callout.Icon>
          <Callout.Text>
            Die Zuteilung ist für dich ausgeblendet (vom Hauptadmin eingestellt). Du siehst nur, wer schon gedreht hat.
          </Callout.Text>
        </Callout.Root>
      )}
      {visibility === 'covered' && (
        <Flex justify="between" align="center" gap="2" wrap="wrap">
          <Text size="2" color="gray">
            Die Namen sind verdeckt. Du kannst sie einzeln oder alle aufdecken.
          </Text>
          {allRevealed ? (
            <Button variant="soft" color="gray" onClick={() => cover()}>
              <EyeClosedIcon /> Alle verdecken
            </Button>
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="soft" color="orange">
                  <EyeOpenIcon /> Alle aufdecken
                </Button>
              }
              title="Alle Namen aufdecken?"
              description="Du siehst dann, wer wen beschenkt. Nach einem Reload ist wieder alles verdeckt."
              confirmLabel="Aufdecken"
              color="red"
              onConfirm={() => reveal()}
            />
          )}
        </Flex>
      )}

      <Card>
        <Flex direction="column" gap="2">
          {state.assignments.map((a, i) => (
            <Flex key={a.giverId} direction="column" gap="2">
              {i > 0 && <Separator size="4" />}
              <AssignmentRow
                assignment={a}
                visibility={visibility}
                revealedName={revealedNames.get(a.giverId)}
                onReveal={() => reveal(a.giverId)}
                onCover={() => cover(a.giverId)}
              />
            </Flex>
          ))}
        </Flex>
      </Card>

      <Flex gap="2" wrap="wrap">
        {visibility === 'visible' && (
          <Button variant="soft" onClick={download} loading={downloading}>
            <DownloadIcon /> Als CSV speichern
          </Button>
        )}
        {visibility === 'covered' && (
          <ConfirmDialog
            trigger={
              <Button variant="soft" loading={downloading}>
                <DownloadIcon /> Als CSV speichern
              </Button>
            }
            title="CSV mit allen Namen speichern?"
            description="Die Datei enthält die komplette Zuteilung, also auch alle verdeckten Namen."
            confirmLabel="Speichern"
            color="red"
            onConfirm={download}
          />
        )}
        <ConfirmDialog
          trigger={
            <Button variant="soft" color="orange">
              <ShuffleIcon /> Neu auslosen
            </Button>
          }
          title="Neu auslosen?"
          description="Alle bekommen eine neue Zuteilung. Wer schon gedreht hat, sieht beim nächsten Drehen einen anderen Namen."
          confirmLabel="Neu auslosen"
          color="red"
          onConfirm={() => run(adminApi.redraw)}
        />
        <ResetDrawButton run={run} />
      </Flex>
    </Flex>
  );
}

function AssignmentRow({
  assignment: a,
  visibility,
  revealedName,
  onReveal,
  onCover,
}: {
  assignment: AdminAssignment;
  visibility: AdminState['assignmentsVisibility'];
  revealedName: string | undefined;
  onReveal: () => void;
  onCover: () => void;
}) {
  const receiver = visibility === 'visible' ? a.receiver : revealedName;

  return (
    <Flex justify="between" align="center" gap="2" wrap="wrap">
      <Flex align="center" gap="2" wrap="wrap">
        <Text weight="bold">{a.giver}</Text>
        {visibility !== 'hidden' && (
          <>
            <ArrowRightIcon />
            {receiver ? (
              <Text>{receiver}</Text>
            ) : (
              <Badge color="gray" variant="soft">
                verdeckt
              </Badge>
            )}
          </>
        )}
        {visibility === 'covered' && (
          <Tooltip content={receiver ? 'Wieder verdecken' : 'Aufdecken'}>
            <IconButton
              size="1"
              variant="ghost"
              color="gray"
              onClick={receiver ? onCover : onReveal}
              aria-label={receiver ? `Namen für ${a.giver} verdecken` : `Namen für ${a.giver} aufdecken`}
            >
              {receiver ? <EyeClosedIcon /> : <EyeOpenIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Flex>
      <Badge color={a.spunAt ? 'green' : 'orange'} variant="soft">
        {a.spunAt ? `gedreht ${formatTimestamp(a.spunAt)}` : 'noch nicht gedreht'}
      </Badge>
    </Flex>
  );
}
