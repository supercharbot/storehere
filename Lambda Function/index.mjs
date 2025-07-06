import { handleWebhook } from './handlers/webhookHandler.mjs';
import { handlePaymentIntent } from './handlers/paymentHandler.mjs';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Stripe-Signature',
    'Content-Type': 'application/json'
  };

  console.log('Lambda triggered:', {
    httpMethod: event.httpMethod,
    headers: event.headers,
    hasStripeSignature: !!(event.headers['stripe-signature'] || event.headers['Stripe-Signature'])
  });

  try {
    // Route Stripe webhooks
    if (event.httpMethod === 'POST' && (event.headers['stripe-signature'] || event.headers['Stripe-Signature'])) {
      return await handleWebhook(event, headers);
    }

    // Route payment intent creation
    if (event.httpMethod === 'POST' && !event.headers['stripe-signature']) {
      return await handlePaymentIntent(event, headers);
    }

    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};