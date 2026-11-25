import { useState, type ReactNode } from 'react';
import { IconButton, Tooltip } from '@radix-ui/themes';
import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';

interface CopyButtonProps {
  text: string;
  label?: string;
  icon?: ReactNode;
}

/** Einheitlicher Kopieren-Button. Zeigt kurz einen Haken, wenn es geklappt hat. */
export function CopyButton({ text, label = 'Kopieren', icon = <CopyIcon /> }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyToClipboard(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Tooltip content={copied ? 'Kopiert!' : label}>
      <IconButton variant="soft" color={copied ? 'green' : 'gray'} onClick={copy} aria-label={label}>
        {copied ? <CheckIcon /> : icon}
      </IconButton>
    </Tooltip>
  );
}

/**
 * Kopiert Text in die Zwischenablage.
 * Die moderne Clipboard-API gibt es nur über HTTPS oder localhost. Über http://IP:Port
 * (Pelican-Allocation ohne Domain) braucht es den alten Weg über ein verstecktes Textfeld.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // weiter mit dem alten Weg
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
