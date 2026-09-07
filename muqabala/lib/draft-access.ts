export async function draftAccess(id: string, request: typeof fetch = fetch): Promise<'ready' | 'missing' | 'retry'> {
  try {
    const response = await request(`/api/interviews/${encodeURIComponent(id)}/report`, { cache: 'no-store' });
    return response.ok ? 'ready' : response.status === 404 ? 'missing' : 'retry';
  } catch {
    return 'retry';
  }
}
