import { Button } from '@radix-ui/themes';
import { ResetIcon } from '@radix-ui/react-icons';
import { adminApi } from '../api';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import type { RunAction } from './AdminApp';

/** „Zurücksetzen“ mit Sicherheitsabfrage. Wird überall gebraucht, wo etwas nur vor der Ziehung änderbar ist. */
export function ResetDrawButton({ run }: { run: RunAction }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="soft" color="red">
          <ResetIcon /> Ziehung zurücksetzen
        </Button>
      }
      title="Ziehung zurücksetzen?"
      description="Die Zuteilung wird gelöscht. Danach kannst du Personen und Ausschlüsse wieder bearbeiten und neu starten."
      confirmLabel="Zurücksetzen"
      onConfirm={() => run(adminApi.resetDraw)}
    />
  );
}
