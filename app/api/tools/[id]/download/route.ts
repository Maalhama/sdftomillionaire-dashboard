import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

const DOWNLOAD_COST = 50;

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
      .select('id, name, downloads_count, status')
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

    // Auth check — téléchargement nécessite un compte
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Connecte-toi pour télécharger.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
    if (!user) {
      return NextResponse.json(
        { error: 'Token invalide.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Vérifier les crédits
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, lifetime_spent')
      .eq('user_id', user.id)
      .single();

    if (!credits || credits.balance < DOWNLOAD_COST) {
      return NextResponse.json(
        {
          error: `Crédits insuffisants. Il te faut ${DOWNLOAD_COST} crédits (solde: ${credits?.balance || 0}).`,
          code: 'INSUFFICIENT_CREDITS',
          balance: credits?.balance || 0,
          cost: DOWNLOAD_COST,
        },
        { status: 402 }
      );
    }

    // Déduire les crédits
    const newBalance = credits.balance - DOWNLOAD_COST;
    const newLifetimeSpent = (credits.lifetime_spent || 0) + DOWNLOAD_COST;
    await supabase
      .from('user_credits')
      .update({ balance: newBalance, lifetime_spent: newLifetimeSpent })
      .eq('user_id', user.id);

    // Log la transaction
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount: -DOWNLOAD_COST,
      type: 'download_spend',
      description: `Téléchargement: ${tool.name}`,
      reference_id: tool.id,
      balance_after: newBalance,
    });

    // Hash IP pour le tracking
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex');

    // Log le téléchargement
    await supabase
      .from('tool_downloads')
      .insert({ tool_id: id, ip_hash: ipHash, user_id: user.id });

    // Incrémenter le compteur de l'outil
    await supabase
      .from('tools')
      .update({ downloads_count: (tool.downloads_count || 0) + 1 })
      .eq('id', id);

    // Incrémenter le compteur du profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('downloads_count')
      .eq('id', user.id)
      .single();

    if (profile) {
      await supabase
        .from('profiles')
        .update({ downloads_count: (profile.downloads_count || 0) + 1 })
        .eq('id', user.id);
    }

    return NextResponse.json({
      success: true,
      downloads_count: (tool.downloads_count || 0) + 1,
      credits_remaining: newBalance,
    });
  } catch {
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
