import { useState } from 'react';

interface CopyFieldProps {
  label: string;
  value: string;
  hint?: string;
}

export function CopyField({ label, value, hint }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="copy-field">
      <span className="copy-field__label">{label}</span>
      {hint && <span className="copy-field__hint">{hint}</span>}
      <div className="copy-field__row">
        <code className="copy-field__value mono">{value}</code>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
