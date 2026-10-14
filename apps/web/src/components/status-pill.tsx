interface StatusPillProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const variant = status === 'error' ? 'error' : status === 'ok' ? 'success' : 'neutral';

  return (
    <span className={`status-pill status-pill--${variant} status-pill--${size}`}>
      <span className="status-pill__dot" aria-hidden />
      {status}
    </span>
  );
}
