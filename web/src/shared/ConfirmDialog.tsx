import type { ReactElement, ReactNode } from 'react';
import { AlertDialog, Button, Flex } from '@radix-ui/themes';

interface ConfirmDialogProps {
  /** Das Element, das den Dialog öffnet (meist ein Button). Ohne Trigger wird er über `open` gesteuert. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  color?: 'red' | 'green' | 'gray';
  onConfirm: () => void;
}

/** Einheitliche Sicherheitsabfrage vor Aktionen, die sich nicht rückgängig machen lassen. */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  color = 'red',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialog.Trigger>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{description}</AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end" wrap="wrap">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              Abbrechen
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color={color} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
