import https from 'https';
import { stringify } from 'querystring';
import { updateContainerPayment } from './databaseHandler.mjs';

export const createWeeklySubscription = async (customerId, metadata, startDate) => {
  try {
    console.log('Creating subscription with price ID:', process.env.STRIPE_WEEKLY_PRICE_ID);
    console.log('Customer ID:', customerId);
    console.log('Start date:', startDate);
    
    const subscriptionData = stringify({
      'customer': customerId,
      'items[0][price]': process.env.STRIPE_WEEKLY_PRICE_ID, // Your $80/week price ID
      'trial_end': Math.floor(startDate.getTime() / 1000),
      'metadata[containerNumber]': metadata.containerNumber,
      'metadata[siteId]': metadata.siteId,
      'metadata[userId]': metadata.userId
    });

    console.log('Subscription data:', subscriptionData);

    const subOptions = {
      hostname: 'api.stripe.com',
      port: 443,
      path: '/v1/subscriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(subscriptionData)
      }
    };

    const subscription = await new Promise((resolve, reject) => {
      const req = https.request(subOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const response = JSON.parse(data);
          console.log('Stripe subscription response:', response);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        });
      });
      req.on('error', (error) => {
        console.error('HTTPS request error:', error);
        reject(error);
      });
      req.write(subscriptionData);
      req.end();
    });

    // Update DynamoDB with subscription ID
    await updateContainerPayment(
      metadata.siteId,
      metadata.containerNumber,
      { stripeSubscriptionId: subscription.id }
    );

    console.log('Weekly subscription created:', subscription.id);
    return subscription;
    
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};