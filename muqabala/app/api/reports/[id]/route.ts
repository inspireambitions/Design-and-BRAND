import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const IdSchema = z.string().uuid();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Report saving is unavailable.' }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const { error } = await supabase.from('saved_reports').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Report could not be deleted.' }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
