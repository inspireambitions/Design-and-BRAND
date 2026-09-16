'use client';

import Link from 'next/link';
import type { RoleNextAction } from '@/lib/recruiter-suite';
import { CopyButton } from './CopyButton';

export function RoleNextActionControl({ action, invitationUrl, className }: { action: RoleNextAction; invitationUrl: string; className?: string }) {
  if (action.kind === 'copy') return <CopyButton className={className} value={invitationUrl} label={action.label} successLabel="Invitation copied." />;
  return action.href ? <Link className={className} href={action.href}>{action.label}</Link> : null;
}
