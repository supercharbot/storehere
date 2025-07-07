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
  
  // Update customer with user ID from client_reference_id if available
  if (paymentIntent.client_reference_id) {
    console.log('Found client_reference_id:', paymentIntent.client_reference_id);
    await updateCustomerWithUserId(paymentIntent.customer, paymentIntent.client_reference_id);
  }
  
  // Handle case where metadata might be empty (payment links)
  if (!metadata.containerNumber) {
    console.log('No container metadata found - this might be from a payment link');
    // For now, just send a basic email and return
    await sendInitialPaymentEmail(paymentIntent);
    return;
  }
  
  // Default to 4 weeks (1 month) if weeksPaid is not provided
  const weeksPaid = parseInt(metadata.weeksPaid) || 4;
  
  // Update container in DynamoDB
  await updateContainerPayment(
    metadata.siteId,
    metadata.containerNumber,
    {
      stripeCustomerId: paymentIntent.customer,
      stripePaymentIntentId: paymentIntent.id, // Track initial payment intent
      securityBondStatus: 'paid',
      subscriptionStatus: 'active',
      status: 'rented-paid',
      rentStartDate: new Date().toISOString(),
      lastPaymentDate: new Date().toISOString(),
      nextDueDate: new Date(Date.now() + (weeksPaid * 7 * 24 * 60 * 60 * 1000)).toISOString()
    }
  );

  // Attach payment method to customer for future subscriptions
  await attachPaymentMethodToCustomer(paymentIntent);

  // Create weekly subscription after prepaid period
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + (weeksPaid * 7));
  await createWeeklySubscription(paymentIntent.customer, metadata, startDate);

  // Send initial payment confirmation email
  await sendInitialPaymentEmail(paymentIntent);
  
  console.log(`Container ${metadata.containerNumber} at site ${metadata.siteId} updated successfully`);
};

const handleInvoicePaymentSucceeded = async (invoice) => {
  console.log('Invoice payment succeeded:', invoice.id);
  
  // Update customer with user ID if we can find it from the payment intent
  if (invoice.payment_intent) {
    try {
      const paymentIntent = await makeStripeRequest(`/v1/payment_intents/${invoice.payment_intent}`, 'GET', '');
      if (paymentIntent.client_reference_id) {
        console.log('Found client_reference_id in payment intent:', paymentIntent.client_reference_id);
        await updateCustomerWithUserId(invoice.customer, paymentIntent.client_reference_id);
      }
    } catch (error) {
      console.error('Error getting payment intent for customer update:', error);
    }
  }
  
  // Check if this is an initial payment invoice (created by payment link)
  // or a recurring subscription invoice
  const isInitialPayment = await checkIfInitialPayment(invoice);
  
  if (isInitialPayment) {
    console.log('Initial payment invoice - welcome email already sent via payment_intent.succeeded');
    // Don't send email again, but still download and save invoice
    await downloadAndSaveInvoice(invoice);
  } else {
    console.log('Recurring payment invoice - sending payment confirmation email');
    await sendSuccessPaymentEmail(invoice);
  }
};

const handleInvoicePaymentFailed = async (invoice) => {
  console.log('Invoice payment failed:', invoice.id);
  await sendFailedPaymentEmail(invoice);
};

// Check if this invoice is from the initial payment (payment link)
const checkIfInitialPayment = async (invoice) => {
  try {
    // Payment link invoices typically don't have a subscription
    // Recurring invoices always have a subscription
    if (!invoice.subscription) {
      console.log('Invoice has no subscription - likely initial payment');
      return true;
    }
    
    // If it has a subscription, check if it's the first invoice
    const subscription = await makeStripeRequest(`/v1/subscriptions/${invoice.subscription}`, 'GET', '');
    
    // Check if the subscription is still in trial period or just started
    if (subscription.status === 'trialing') {
      console.log('Subscription is in trial - invoice is from initial payment');
      return true;
    }
    
    // Check invoice metadata for paymentIntentId (initial payments have this)
    if (invoice.metadata && invoice.metadata.paymentIntentId) {
      console.log('Invoice has paymentIntentId metadata - initial payment');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if initial payment:', error);
    return false; // Default to treating as recurring to be safe
  }
};

// Download invoice PDF and save to S3
const downloadAndSaveInvoice = async (invoice) => {
  try {
    // Get customer to extract user ID
    const customer = await makeStripeRequest(`/v1/customers/${invoice.customer}`, 'GET', '');
    const userId = customer.metadata?.userId;
    
    if (!userId) {
      console.error('No user ID found in customer metadata');
      return;
    }
    
    // Download invoice PDF
    const invoicePdf = await downloadInvoicePdf(invoice.invoice_pdf);
    
    if (!invoicePdf) {
      console.error('Failed to download invoice PDF');
      return;
    }
    
    // Save to S3
    await saveInvoiceToS3(invoicePdf, userId, invoice.number);
    
    console.log(`Invoice ${invoice.number} saved to S3 for user ${userId}`);
  } catch (error) {
    console.error('Error downloading and saving invoice:', error);
  }
};

// Download PDF from Stripe
const downloadInvoicePdf = async (pdfUrl) => {
  try {
    const url = new URL(pdfUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      });
      
      req.on('error', (error) => {
        console.error('Error downloading PDF:', error);
        reject(error);
      });
      
      req.end();
    });
  } catch (error) {
    console.error('Error in downloadInvoicePdf:', error);
    return null;
  }
};

// Save invoice to S3
const saveInvoiceToS3 = async (pdfBuffer, userId, invoiceNumber) => {
  try {
    // Import AWS SDK
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    
    const key = `${userId}/invoice-${invoiceNumber}.pdf`;
    
    const command = new PutObjectCommand({
      Bucket: 'storehere-invoices',
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        'invoice-number': invoiceNumber,
        'user-id': userId,
        'upload-date': new Date().toISOString()
      }
    });
    
    await s3Client.send(command);
    console.log(`Invoice saved to S3: storehere-invoices/${key}`);
  } catch (error) {
    console.error('Error saving to S3:', error);
    throw error;
  }
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

// Update customer with user ID from payment link
const updateCustomerWithUserId = async (customerId, userId) => {
  try {
    const updateData = stringify({
      'metadata[userId]': userId
    });

    await makeStripeRequest(`/v1/customers/${customerId}`, 'POST', updateData);
    console.log(`Updated customer ${customerId} with userId: ${userId}`);
  } catch (error) {
    console.error('Error updating customer with user ID:', error);
  }
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