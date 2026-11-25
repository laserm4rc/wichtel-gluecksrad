import type { ReactNode } from 'react';
import { Box, Container, Flex, Heading, IconButton, Tooltip } from '@radix-ui/themes';
import { MoonIcon, SunIcon } from '@radix-ui/react-icons';
import type { Appearance } from './useAppearance';

interface PageShellProps {
  title: string;
  appearance: Appearance;
  onToggleAppearance: () => void;
  /** Zusätzliche Buttons oben rechts, z. B. Abmelden */
  actions?: ReactNode;
  /** Maximale Breite: 1 = Handy-Seite für Teilnehmer, 2 = breiter für den Admin */
  size?: '1' | '2';
  children: ReactNode;
}

/** Gemeinsamer Rahmen für alle Seiten: Kopfzeile mit Titel, Hell/Dunkel-Schalter und Inhalt. */
export function PageShell({ title, appearance, onToggleAppearance, actions, size = '1', children }: PageShellProps) {
  const nextLabel = appearance === 'dark' ? 'Hellen Modus einschalten' : 'Dunklen Modus einschalten';
  return (
    <Container size={size} px="4" py="5">
      <Flex direction="column" gap="5">
        <Flex align="center" justify="between" gap="3">
          <Heading as="h1" size="6" truncate>
            {title}
          </Heading>
          <Flex gap="2" flexShrink="0">
            {actions}
            <Tooltip content={nextLabel}>
              <IconButton variant="soft" color="gray" onClick={onToggleAppearance} aria-label={nextLabel}>
                {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
              </IconButton>
            </Tooltip>
          </Flex>
        </Flex>
        <Box>{children}</Box>
      </Flex>
    </Container>
  );
}
