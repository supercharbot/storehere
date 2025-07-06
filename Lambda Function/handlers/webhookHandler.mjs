import { createWeeklySubscription } from './subscriptionHandler.mjs';
import { sendInitialPaymentEmail, sendSuccessPaymentEmail, sendFailedPaymentEmail } from './emailHandler.mjs';
import { updateContainerPayment } from './databaseHandler.mjs';
import https from 'https';
import { stringify } from 'querystring';

export const handleWebhook = async (event, headers) => {
  try {
    const body = JSON.parse(event.body);
    console.log('Webhook received:', body.type);
    
    switch (body.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(body.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(body.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(body.data.object);
        break;
        
      default:
        console.log('Unhandled webhook type:', body.type);
    }
    
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ received: true }) 
    };
    
  } catch (error) {
    console.error('Webhook error:', error);
    return { 
      statusCode: 400, 
      headers, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  const metadata = paymentIntent.metadata;
  
  console.log('Payment succeeded:', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    customer: paymentIntent.customer,
    metadata: metadata
  });
  
  // Update container in DynamoDB
  await updateContainerPayment(
    metadata.siteId,
    metadata.containerNumber,
    {
      stripeCustomerId: paymentIntent.customer,
      securityBondStatus: 'paid',
      subscriptionStatus: 'active',
      status: 'rented-paid',
      rentStartDate: new Date().toISOString(),
      lastPaymentDate: new Date().toISOString(),
      nextDueDate: new Date(Date.now() + (parseInt(metadata.weeksPaid) * 7 * 24 * 60 * 60 * 1000)).toISOString()
    }
  );

  // Attach payment method to customer for future subscriptions
  await attachPaymentMethodToCustomer(paymentIntent);

  // Create weekly subscription after prepaid period
  if (metadata.weeksPaid) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + (parseInt(metadata.weeksPaid) * 7));
    await createWeeklySubscription(paymentIntent.customer, metadata, startDate);
  }

  // Don't create invoice yet - just send initial email
  // const invoice = await createInitialPaymentInvoice(paymentIntent);

  // Send initial payment confirmation email with invoice
  await sendInitialPaymentEmail(paymentIntent);
  
  console.log(`Container ${metadata.containerNumber} at site ${metadata.siteId} updated successfully`);
};

const handleInvoicePaymentSucceeded = async (invoice) => {
  console.log('Invoice payment succeeded:', invoice.id);
  await sendSuccessPaymentEmail(invoice);
};

const handleInvoicePaymentFailed = async (invoice) => {
  console.log('Invoice payment failed:', invoice.id);
  await sendFailedPaymentEmail(invoice);
};

// Create invoice for initial payment
const createInitialPaymentInvoice = async (paymentIntent) => {
  try {
    // Create invoice items for the breakdown
    const securityBondItem = await createInvoiceItem(
      paymentIntent.customer,
      30000, // $300 in cents
      'Security Bond'
    );
    
    const storageItem = await createInvoiceItem(
      paymentIntent.customer,
      32000, // $320 in cents (4 weeks × $80)
      `Storage Rental - ${paymentIntent.metadata.weeksPaid} weeks prepaid`
    );

    // Create the invoice
    const invoiceData = stringify({
      'customer': paymentIntent.customer,
      'collection_method': 'charge_automatically',
      'auto_advance': 'false', // Don't auto-finalize
      'metadata[paymentIntentId]': paymentIntent.id,
      'metadata[containerNumber]': paymentIntent.metadata.containerNumber,
      'metadata[siteId]': paymentIntent.metadata.siteId
    });

    const invoice = await makeStripeRequest('/v1/invoices', 'POST', invoiceData);
    
    // Finalize the invoice
    const finalizedInvoice = await makeStripeRequest(`/v1/invoices/${invoice.id}/finalize`, 'POST', '');
    
    // Mark as paid since payment already succeeded
    const paidInvoice = await makeStripeRequest(`/v1/invoices/${invoice.id}/pay`, 'POST', 'paid_out_of_band=true');
    
    console.log('Created invoice:', paidInvoice.id);
    return paidInvoice;
    
  } catch (error) {
    console.error('Error creating initial payment invoice:', error);
    return null;
  }
};

const createInvoiceItem = async (customerId, amount, description) => {
  const itemData = stringify({
    'customer': customerId,
    'amount': amount,
    'currency': 'aud',
    'description': description
  });

  return await makeStripeRequest('/v1/invoiceitems', 'POST', itemData);
};

const makeStripeRequest = async (path, method, data) => {
  const options = {
    hostname: 'api.stripe.com',
    port: 443,
    path: path,
    method: method,
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        const response = JSON.parse(responseData);
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

// Attach payment method to customer for future billing
const attachPaymentMethodToCustomer = async (paymentIntent) => {
  try {
    // Get the payment method ID from the payment intent
    const paymentMethodId = paymentIntent.payment_method;
    
    if (!paymentMethodId) {
      console.warn('No payment method found on payment intent');
      return;
    }

    // Try to attach payment method to customer
    const attachData = stringify({
      'customer': paymentIntent.customer
    });

    try {
      await makeStripeRequest(`/v1/payment_methods/${paymentMethodId}/attach`, 'POST', attachData);

      // Set as default payment method for the customer
      const updateData = stringify({
        'invoice_settings[default_payment_method]': paymentMethodId
      });

      await makeStripeRequest(`/v1/customers/${paymentIntent.customer}`, 'POST', updateData);
      
      console.log(`Payment method ${paymentMethodId} attached to customer ${paymentIntent.customer}`);
    } catch (attachError) {
      console.log('Payment method attachment failed, checking for existing methods:', attachError.message);
      
      // Check if customer already has payment methods
      const paymentMethods = await makeStripeRequest(`/v1/payment_methods?customer=${paymentIntent.customer}&type=card`, 'GET', '');
      
      if (paymentMethods.data && paymentMethods.data.length > 0) {
        console.log(`Customer already has ${paymentMethods.data.length} payment methods`);
        return;
      }
      
      // If no payment methods exist, log warning but continue
      console.warn('No payment methods available for future billing - subscription may fail when trial ends');
    }
  } catch (error) {
    console.error('Error in payment method handling:', error);
    // Don't throw error - continue with subscription creation
  }
};