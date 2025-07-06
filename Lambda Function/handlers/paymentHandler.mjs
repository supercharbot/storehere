import https from 'https';
import { stringify } from 'querystring';

export const handlePaymentIntent = async (event, headers) => {
  try {
    const { amount, currency, metadata } = JSON.parse(event.body);
    
    // Create customer first
    console.log('Creating customer with email:', metadata.userEmail);
    const customer = await createStripeCustomer(metadata);
    console.log('Created customer ID:', customer.id);
    
    // Create payment intent
    const paymentIntent = await createStripePaymentIntent(amount, currency, customer.id, metadata);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret })
    };
    
  } catch (error) {
    console.error('Payment error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

const createStripeCustomer = async (metadata) => {
  const customerData = stringify({
    'email': metadata.userEmail,
    'name': metadata.userEmail,
    'metadata[userId]': metadata.userId
  });

  const options = {
    hostname: 'api.stripe.com',
    port: 443,
    path: '/v1/customers',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(customerData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const response = JSON.parse(data);
        console.log('Customer creation response:', response);
        resolve(response);
      });
    });
    req.on('error', reject);
    req.write(customerData);
    req.end();
  });
};

const createStripePaymentIntent = async (amount, currency, customerId, metadata) => {
  const postData = stringify({
    amount,
    currency,
    'customer': customerId,
    'automatic_payment_methods[enabled]': 'true',
    ...(metadata ? Object.entries(metadata).reduce((acc, [key, value]) => {
      acc[`metadata[${key}]`] = value;
      return acc;
    }, {}) : {})
  });

  const options = {
    hostname: 'api.stripe.com',
    port: 443,
    path: '/v1/payment_intents',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};