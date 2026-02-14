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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  const { id } = await params;

  try {
    // Vérifier que le prompt existe et est éligible au vote
    const { data: prompt, error: fetchError } = await supabase
      .from('user_prompts')
      .select('id, status, voting_deadline, votes_count')
      .eq('id', id)
      .single();

    if (fetchError || !prompt) {
      return NextResponse.json(
        { error: 'Prompt introuvable.' },
        { status: 404 }
      );
    }

    if (prompt.status !== 'evaluated') {
      return NextResponse.json(
        { error: 'Ce prompt n\'est pas ouvert au vote.' },
        { status: 400 }
      );
    }

    if (!prompt.voting_deadline || new Date(prompt.voting_deadline) <= new Date()) {
      return NextResponse.json(
        { error: 'La période de vote est terminée.' },
        { status: 410 }
      );
    }

    // Hash IP pour dédoublonnage
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex');

    // Vérifier doublon par IP
    const { data: existingIpVote } = await supabase
      .from('user_votes')
      .select('id')
      .eq('prompt_id', id)
      .eq('ip_hash', ipHash)
      .single();

    if (existingIpVote) {
      return NextResponse.json(
        { error: 'Tu as déjà voté pour cette idée.' },
        { status: 409 }
      );
    }

    // Insérer le vote
    const { error: insertError } = await supabase
      .from('user_votes')
      .insert({
        prompt_id: id,
        ip_hash: ipHash,
      });

    if (insertError) {
      // Contrainte UNIQUE violée (race condition)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Tu as déjà voté pour cette idée.' },
          { status: 409 }
        );
      }
      console.error('Vote insert error:', insertError);
      return NextResponse.json(
        { error: 'Erreur lors du vote.' },
        { status: 500 }
      );
    }

    // Incrémenter le compteur prompt (atomic via SQL)
    const { error: updateError } = await supabase.rpc('increment_counter', {
      table_name: 'user_prompts',
      column_name: 'votes_count',
      row_id: id,
    });

    if (updateError) {
      // Fallback: incrémentation directe si la RPC n'existe pas encore
      console.warn('RPC increment_counter not available, using fallback:', updateError.message);
      await supabase
        .from('user_prompts')
        .update({ votes_count: (prompt.votes_count || 0) + 1 })
        .eq('id', id);
    }

    return NextResponse.json({
      success: true,
      votes_count: (prompt.votes_count || 0) + 1,
    });
  } catch (err) {
    console.error('Vote error:', err);
    return NextResponse.json(
      { error: 'Requête invalide.' },
      { status: 400 }
    );
  }
}
