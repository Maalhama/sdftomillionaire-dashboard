import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_CHARS = 350;

export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { content, author_name } = body;

    // Validate input
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (!trimmed) {
      return NextResponse.json(
        { error: 'Le contenu est requis.' },
        { status: 400 }
      );
    }
    if (trimmed.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `Le contenu ne doit pas dépasser ${MAX_CHARS} caractères.` },
        { status: 400 }
      );
    }

    // Get client IP and hash it
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex');

    // Check if this IP already submitted today
    const today = new Date().toISOString().split('T')[0];
    const { count, error: countError } = await supabase
      .from('user_prompts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', `${today}T00:00:00`);

    if (countError) {
      console.error('Rate limit check error:', countError);
      return NextResponse.json(
        { error: 'Erreur serveur.' },
        { status: 500 }
      );
    }

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Tu as déjà soumis une idée aujourd\'hui. Reviens demain !' },
        { status: 429 }
      );
    }

    // Insert prompt with IP hash
    const { error: insertError } = await supabase
      .from('user_prompts')
      .insert({
        content: trimmed,
        author_name: typeof author_name === 'string' && author_name.trim() ? author_name.trim() : 'Anonyme',
        ip_hash: ipHash,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Erreur lors de la soumission.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Requête invalide.' },
      { status: 400 }
    );
  }
}
