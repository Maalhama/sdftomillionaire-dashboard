import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/credits — Récupérer le solde de l'utilisateur
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: 'Token invalide.' }, { status: 401 });
  }

  // Récupérer ou créer les crédits
  let { data: credits } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!credits) {
    // Créer l'entrée si elle n'existe pas (edge case: ancien user sans credits)
    await supabase.from('user_credits').insert({
      user_id: user.id,
      balance: 100,
      lifetime_earned: 100,
      last_monthly_grant: new Date().toISOString(),
    });

    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount: 100,
      type: 'monthly_grant',
      description: 'Bienvenue ! 100 crédits offerts.',
      balance_after: 100,
    });

    credits = { balance: 100, lifetime_earned: 100, lifetime_spent: 0 };
  }

  // Récupérer les dernières transactions
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('amount, type, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    balance: credits.balance,
    lifetime_earned: credits.lifetime_earned,
    lifetime_spent: credits.lifetime_spent,
    transactions: transactions || [],
  });
}
