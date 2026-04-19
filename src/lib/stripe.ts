import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia', // Updated to the latest stable API version syntax
  appInfo: {
    name: 'THEA-X Accounting',
    version: '0.1.0',
  },
});