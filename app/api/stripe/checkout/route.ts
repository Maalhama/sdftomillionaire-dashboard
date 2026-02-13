import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, getPackById } from '@/lib/stripe';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.split(' ')[1]);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token invalide.' }, { status: 401 });
    }

    const body = await req.json();
    const { pack_id } = body;

    const pack = getPackById(pack_id);
    if (!pack) {
      return NextResponse.json({ error: 'Pack inconnu.' }, { status: 400 });
    }

    const stripe = getStripe();
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://sdftomillionaire.com';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: pack.price_cents,
            product_data: {
              name: `${pack.name} — ${pack.credits} crédits`,
              description: `Pack de ${pack.credits} crédits SDFtoMillionaire`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/pricing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?status=cancelled`,
      client_reference_id: user.id,
      metadata: {
        pack_id: pack.id,
        credits_amount: String(pack.credits),
        user_id: user.id,
      },
    });

    // Insert pending purchase
    await supabase.from('credit_purchases').insert({
      user_id: user.id,
      stripe_session_id: session.id,
      pack_id: pack.id,
      credits_amount: pack.credits,
      price_cents: pack.price_cents,
      status: 'pending',
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: 'Erreur lors de la création du paiement.' }, { status: 500 });
  }
}
