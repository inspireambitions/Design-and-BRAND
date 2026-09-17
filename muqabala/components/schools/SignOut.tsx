'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearStudentDrafts } from '@/lib/schools/draft-storage';

export function SchoolsSignOut({
  everywhere = false,
  studentUserId,
}: {
  everywhere?: boolean;
  studentUserId?: string;
}) {
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <div>
      <button
        onClick={async () => {
          try {
            clearStudentDrafts(studentUserId);
            const response = await fetch('/api/schools/sign-out', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ everywhere }),
            });
            if (!response.ok) throw new Error();
            router.replace('/schools/sign-in');
            router.refresh();
          } catch {
            setError('Could not sign out. Please try again.');
          }
        }}
      >
        {everywhere ? 'Sign out everywhere' : 'Sign out'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
