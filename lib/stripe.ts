import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  price_display: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack_500',
    name: 'Starter',
    credits: 500,
    price_cents: 499,
    price_display: '4,99€',
  },
  {
    id: 'pack_1500',
    name: 'Pro',
    credits: 1500,
    price_cents: 999,
    price_display: '9,99€',
    popular: true,
  },
  {
    id: 'pack_5000',
    name: 'Business',
    credits: 5000,
    price_cents: 2499,
    price_display: '24,99€',
  },
];

export function getPackById(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}
