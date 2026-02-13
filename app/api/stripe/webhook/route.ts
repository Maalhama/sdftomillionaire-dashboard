import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import Stripe from 'stripe';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true });
    }

    const userId = session.metadata?.user_id || session.client_reference_id;
    const creditsAmount = parseInt(session.metadata?.credits_amount || '0', 10);
    const packId = session.metadata?.pack_id || '';

    if (!userId || !creditsAmount) {
      console.error('Missing metadata in checkout session:', session.id);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Mark purchase as completed
    await supabase
      .from('credit_purchases')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('stripe_session_id', session.id);

    // Credit the user
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, lifetime_earned')
      .eq('user_id', userId)
      .single();

    if (credits) {
      await supabase
        .from('user_credits')
        .update({
          balance: credits.balance + creditsAmount,
          lifetime_earned: credits.lifetime_earned + creditsAmount,
        })
        .eq('user_id', userId);
    } else {
      await supabase.from('user_credits').insert({
        user_id: userId,
        balance: creditsAmount,
        lifetime_earned: creditsAmount,
        lifetime_spent: 0,
      });
    }

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: creditsAmount,
      type: 'purchase',
      description: `Achat pack ${packId} — ${creditsAmount} crédits`,
    });

    console.log(`Credits added: ${creditsAmount} to user ${userId} (session ${session.id})`);
  }

  return NextResponse.json({ received: true });
}
