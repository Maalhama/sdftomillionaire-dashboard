import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  const { id } = await params;

  try {
    // Vérifier que le tool existe
    const { data: tool, error: fetchError } = await supabase
      .from('tools')
      .select('id, downloads_count, status')
      .eq('id', id)
      .single();

    if (fetchError || !tool) {
      return NextResponse.json(
        { error: 'Outil introuvable.' },
        { status: 404 }
      );
    }

    if (tool.status !== 'published') {
      return NextResponse.json(
        { error: 'Outil non disponible.' },
        { status: 400 }
      );
    }

    // Hash IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex');

    // Log le téléchargement
    await supabase
      .from('tool_downloads')
      .insert({ tool_id: id, ip_hash: ipHash });

    // Incrémenter le compteur
    await supabase
      .from('tools')
      .update({ downloads_count: (tool.downloads_count || 0) + 1 })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      downloads_count: (tool.downloads_count || 0) + 1,
    });
  } catch {
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
