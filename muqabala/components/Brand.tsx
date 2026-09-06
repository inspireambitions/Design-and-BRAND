import Link from 'next/link';

/** The same identity in marketing, private practice and employer tools. */
export function MuqabalaMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="32" height="32" aria-hidden="true" focusable="false">
      <path d="M 26 36 A 27 27 0 1 0 70 36" fill="none" stroke={inverse ? '#F3F7F5' : 'currentColor'} strokeWidth="11" strokeLinecap="round" />
      <circle cx="35" cy="17" r="7.5" fill={inverse ? '#F3F7F5' : 'currentColor'} />
      <circle cx="61" cy="17" r="7.5" fill="#B9892E" />
    </svg>
  );
}

export function Brand({ locked = false, owner, inverse = false, className = '' }: {
  locked?: boolean;
  owner?: string;
  inverse?: boolean;
  className?: string;
}) {
  const content = <><MuqabalaMark inverse={inverse} /><span>Muqabala</span>{owner && <small className="brand-owner">{owner}</small>}</>;
  const classes = `brand ${className}`.trim();
  return locked
    ? <span className={classes}>{content}</span>
    : <Link href="/" className={classes} aria-label="Muqabala home">{content}</Link>;
}
