import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20',
  appInfo: {
    name: 'THEA-X Accounting',
    version: '0.1.0',
  },
});