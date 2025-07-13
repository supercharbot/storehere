import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import https from 'https';

// Initialize AWS clients
const sesClient = new SESClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const PRICE_IDS = {
  weekly: 'price_1RjwDqCWFO1syG1hk95AuQa1',
  fortnightly: 'price_1RjwFeCWFO1syG1hAVCQ4YjQ',
  monthly: 'price_1RjwRTCWFO1syG1hpTakQTT3',
  securityBond: 'price_1RjwSbCWFO1syG1hBIfjVFBm',
  startingPayment: 'price_1RjwUyCWFO1syG1hff6fxYqo'
};

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Stripe-Signature',
    'Access-Control-Allow-Methods': 'POST',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Handle different endpoints
    const path = event.path || event.routeKey;
    
    if (path.includes('/create-customer')) {
      return await handleCreatePaymentIntent(event, headers);
    } else if (path.includes('/webhook')) {
      return await handleWebhook(event, headers);
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' })
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

// Create Payment Intent endpoint
async function handleCreatePaymentIntent(event, headers) {
  try {
    const { 
      billingFrequency, 
      userEmail, 
      userName, 
      containerId, 
      siteId,
      userAttributes 
    } = JSON.parse(event.body);

    // Create or retrieve customer
    const customer = await createOrGetCustomer(userEmail, userName);

    // Create checkout session for $640 (starting payment + bond)
    const session = await createCheckoutSession({
      customerId: customer.id,
      billingFrequency,
      metadata: {
        billing_frequency: billingFrequency,
        container_id: containerId,
        site_id: siteId,
        user_email: userEmail,
        user_name: userName,
        user_id: userAttributes?.sub,
        payment_type: 'initial'
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sessionUrl: session.url,
        customerId: customer.id
      })
    };

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// Create checkout session
async function createCheckoutSession({ customerId, billingFrequency, metadata }) {
  const sessionData = new URLSearchParams({
    customer: customerId,
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'aud',
    'line_items[0][price_data][product_data][name]': '4 weeks storage rent',
    'line_items[0][price_data][unit_amount]': '34000',
    'line_items[0][quantity]': '1',
    'line_items[1][price_data][currency]': 'aud',
    'line_items[1][price_data][product_data][name]': 'Security bond (refundable)',
    'line_items[1][price_data][unit_amount]': '30000',
    'line_items[1][quantity]': '1',
    mode: 'payment',
    'success_url': 'http://localhost:3000/payment?success=true',
    'cancel_url': 'http://localhost:3000/payment?canceled=true',
    'invoice_creation[enabled]': 'true'
  });

  // Add metadata
  Object.entries(metadata).forEach(([key, value]) => {
    sessionData.append(`metadata[${key}]`, value);
  });

  return await makeStripeRequest('/v1/checkout/sessions', 'POST', sessionData.toString());
}

// Webhook handler
async function handleWebhook(event, headers) {
  try {
    const body = JSON.parse(event.body);
    console.log('Webhook event received:', body.type);

    switch (body.type) {
      case 'checkout.session.completed':
        await handleInitialPaymentSuccess(body.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleRecurringPaymentSuccess(body.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(body.data.object);
        break;
      default:
        console.log('Unhandled event type:', body.type);
    }

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ received: true }) 
    };
  } catch (error) {
    console.error('Webhook processing error:', error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Internal server error' }) 
    };
  }
}

// Handle successful initial payment ($640)
async function handleInitialPaymentSuccess(session) {
  console.log('Processing initial payment success:', session.id);
  
  try {
    const metadata = session.metadata;
    const customerId = session.customer;
    
    // Get customer details
    const customer = await makeStripeRequest(`/v1/customers/${customerId}`, 'GET');
    
    // Find and assign container
    const container = await findAndAssignContainer(
      customerId, 
      metadata.user_email, 
      metadata.container_id,
      metadata.site_id
    );
    
    if (!container) {
      throw new Error('No available containers found');
    }
    
    // Create subscription with 28-day trial
    await createSubscription(customerId, metadata.billing_frequency);
    
    // Get invoice from session and send welcome email
    const invoice = await makeStripeRequest(`/v1/invoices/${session.invoice}`, 'GET');
    await sendWelcomeEmail(metadata.user_email, container, session, invoice);
    
    // Save invoice to S3
    await saveInvoiceToS3(invoice, metadata.user_email, customerId);
    
    console.log(`Initial payment processed successfully for ${metadata.user_email}`);
    
  } catch (error) {
    console.error('Error processing initial payment:', error);
    throw error;
  }
}

// Handle recurring payment success
async function handleRecurringPaymentSuccess(invoice) {
  console.log('Processing recurring payment success for invoice:', invoice.id);
  
  try {
    // Skip $0 trial invoices
    if (invoice.amount_paid === 0) {
      console.log('Skipping $0 trial invoice');
      return;
    }
    
    const customer = await makeStripeRequest(`/v1/customers/${invoice.customer}`, 'GET');
    const container = await getContainerByCustomerId(invoice.customer);
    
    if (!container) {
      console.error('Container not found for customer:', invoice.customer);
      return;
    }
    
    // Update container payment status
    await updateContainerPayment(container, {
      lastPaymentDate: new Date().toISOString(),
      subscriptionStatus: 'active'
    });
    
    // Send payment confirmation email
    await sendPaymentConfirmationEmail(customer.email, invoice, container);
    
    // Save invoice to S3
    await saveInvoiceToS3(invoice, customer.email, invoice.customer);
    
  } catch (error) {
    console.error('Error processing recurring payment success:', error);
  }
}

// Handle payment failure
async function handlePaymentFailed(invoice) {
  console.log('Processing payment failure for invoice:', invoice.id);
  
  try {
    const customer = await makeStripeRequest(`/v1/customers/${invoice.customer}`, 'GET');
    const container = await getContainerByCustomerId(invoice.customer);
    
    if (!container) {
      console.error('Container not found for customer:', invoice.customer);
      return;
    }
    
    // Update container status
    await updateContainerPayment(container, {
      subscriptionStatus: 'past_due',
      overdueSince: new Date().toISOString()
    });
    
    // Send payment failed email
    await sendPaymentFailedEmail(customer.email, invoice, container);
    
  } catch (error) {
    console.error('Error processing payment failure:', error);
  }
}

// Create subscription with trial
async function createSubscription(customerId, billingFrequency) {
  const priceId = PRICE_IDS[billingFrequency];
  
  if (!priceId) {
    throw new Error(`Invalid billing frequency: ${billingFrequency}`);
  }
  
  const subscriptionData = new URLSearchParams({
    customer: customerId,
    'items[0][price]': priceId,
    'trial_period_days': '28', // 28-day trial
    'payment_behavior': 'default_incomplete',
    'payment_settings[payment_method_types][0]': 'card',
    'expand[0]': 'latest_invoice.payment_intent'
  });
  
  return await makeStripeRequest('/v1/subscriptions', 'POST', subscriptionData.toString());
}

// Create invoice for initial payment
async function createInitialPaymentInvoice(customerId) {
  // Create invoice items using amount instead of price IDs
  const startingPaymentItem = new URLSearchParams({
    customer: customerId,
    amount: '34000', // $340 in cents
    currency: 'aud',
    description: '4 weeks storage rent'
  });
  
  const bondItem = new URLSearchParams({
    customer: customerId, 
    amount: '30000', // $300 in cents
    currency: 'aud',
    description: 'Security bond (refundable)'
  });
  
  await makeStripeRequest('/v1/invoiceitems', 'POST', startingPaymentItem.toString());
  await makeStripeRequest('/v1/invoiceitems', 'POST', bondItem.toString());
  
  // Create invoice
  const invoiceData = new URLSearchParams({
    customer: customerId,
    auto_advance: 'false'
  });
  
  const invoice = await makeStripeRequest('/v1/invoices', 'POST', invoiceData.toString());
  return await makeStripeRequest(`/v1/invoices/${invoice.id}/finalize`, 'POST');
}

// Create or get customer
async function createOrGetCustomer(email, name) {
  const existingCustomers = await makeStripeRequest(`/v1/customers/search?query=email:"${email}"`, 'GET');
  
  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  const customerData = new URLSearchParams({
    email: email,
    name: name
  });

  return await makeStripeRequest('/v1/customers', 'POST', customerData.toString());
}

// Create Payment Intent
async function createPaymentIntent({ amount, customerId, metadata }) {
  const paymentData = new URLSearchParams({
    amount: amount,
    currency: 'aud',
    customer: customerId,
    'payment_method_types[]': 'card',
    confirmation_method: 'automatic',
    confirm: 'false'
  });

  Object.entries(metadata).forEach(([key, value]) => {
    paymentData.append(`metadata[${key}]`, value);
  });

  return await makeStripeRequest('/v1/payment_intents', 'POST', paymentData.toString());
}

// Find and assign container
async function findAndAssignContainer(stripeCustomerId, customerEmail, preferredContainerId, preferredSiteId) {
  // Try preferred container first
  if (preferredContainerId && preferredSiteId) {
    try {
      const containerResult = await dynamoDb.send(new ScanCommand({
        TableName: process.env.DYNAMODB_TABLE,
        FilterExpression: 'PK = :pk AND SK = :sk AND #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `SITE#${preferredSiteId}`,
          ':sk': `CONTAINER#${preferredContainerId}`,
          ':status': 'available'
        }
      }));

      if (containerResult.Items.length > 0) {
        const container = containerResult.Items[0];
        await assignContainer(container, stripeCustomerId, customerEmail, preferredSiteId);
        return { ...container, siteId: preferredSiteId };
      }
    } catch (error) {
      console.log('Preferred container not available, searching for alternatives');
    }
  }

  // Find any available container
  const sitesResult = await dynamoDb.send(new ScanCommand({
    TableName: process.env.DYNAMODB_TABLE,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'METADATA' }
  }));
  
  for (const site of sitesResult.Items) {
    const containersResult = await dynamoDb.send(new ScanCommand({
      TableName: process.env.DYNAMODB_TABLE,
      FilterExpression: 'PK = :pk AND begins_with(SK, :sk) AND #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': `SITE#${site.id}`,
        ':sk': 'CONTAINER#',
        ':status': 'available'
      }
    }));
    
    if (containersResult.Items.length > 0) {
      const container = containersResult.Items[0];
      await assignContainer(container, stripeCustomerId, customerEmail, site.id);
      return { ...container, siteId: site.id };
    }
  }
  
  return null;
}

// Assign container to customer
async function assignContainer(container, stripeCustomerId, customerEmail, siteId) {
  await updateContainerPayment(container, {
    stripeCustomerId: stripeCustomerId,
    customerEmail: customerEmail,
    subscriptionStatus: 'trialing',
    securityBondStatus: 'paid',
    status: 'rented-paid',
    rentStartDate: new Date().toISOString(),
    lastPaymentDate: new Date().toISOString(),
    nextDueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString()
  });
}

// Get container by customer ID
async function getContainerByCustomerId(customerId) {
  const result = await dynamoDb.send(new ScanCommand({
    TableName: process.env.DYNAMODB_TABLE,
    FilterExpression: 'stripeCustomerId = :customerId',
    ExpressionAttributeValues: { ':customerId': customerId }
  }));
  
  return result.Items[0] || null;
}

// Update container payment info
async function updateContainerPayment(container, updates) {
  const updateExpressions = [];
  const expressionValues = {};
  const expressionNames = {};
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key === 'status') {
      updateExpressions.push(`#status = :${key}`);
      expressionNames['#status'] = 'status';
    } else {
      updateExpressions.push(`${key} = :${key}`);
    }
    expressionValues[`:${key}`] = value;
  });
  
  const updateParams = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: { PK: container.PK, SK: container.SK },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeValues: expressionValues
  };
  
  if (Object.keys(expressionNames).length > 0) {
    updateParams.ExpressionAttributeNames = expressionNames;
  }
  
  await dynamoDb.send(new UpdateCommand(updateParams));
}

// Stripe API helper
async function makeStripeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || 'Stripe API error'));
          } else {
            resolve(parsed);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Send welcome email
async function sendWelcomeEmail(email, container, session, invoice) {
  const params = {
    Source: process.env.FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Welcome to StoreHere - Payment Confirmed!' },
      Body: {
        Html: {
          Data: `
            <h2>Welcome to StoreHere!</h2>
            <p>Your payment of $640 has been processed successfully.</p>
            <p><strong>Container Details:</strong></p>
            <ul>
              <li>Container Number: ${container.number}</li>
              <li>Site: ${container.siteId}</li>
              <li>Trial period: 28 days included</li>
              <li>Then: ${session.metadata.billing_frequency} billing at chosen rate</li>
            </ul>
            <p>Your subscription will start automatically after the 28-day period.</p>
            <p><a href="${invoice.hosted_invoice_url}">View Invoice</a></p>
          `
        }
      }
    }
  };
  
  await sesClient.send(new SendEmailCommand(params));
}

// Send payment confirmation email
async function sendPaymentConfirmationEmail(email, invoice, container) {
  const params = {
    Source: process.env.FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'StoreHere - Payment Confirmed' },
      Body: {
        Html: {
          Data: `
            <h2>Payment Confirmation</h2>
            <p>Your payment has been processed successfully.</p>
            <p><strong>Container:</strong> ${container.number}</p>
            <p><strong>Amount:</strong> $${(invoice.amount_paid / 100).toFixed(2)}</p>
            <p><a href="${invoice.hosted_invoice_url}">View Invoice</a></p>
          `
        }
      }
    }
  };
  
  await sesClient.send(new SendEmailCommand(params));
}

// Send payment failed email
async function sendPaymentFailedEmail(email, invoice, container) {
  const params = {
    Source: process.env.FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'StoreHere - Payment Unsuccessful' },
      Body: {
        Html: {
          Data: `
            <h2>Payment Unsuccessful</h2>
            <p>We were unable to process your payment.</p>
            <p><strong>Container:</strong> ${container.number}</p>
            <p>Please update your payment method to avoid service interruption.</p>
          `
        }
      }
    }
  };
  
  await sesClient.send(new SendEmailCommand(params));
}

async function saveInvoiceToS3(invoice, customerEmail, stripeCustomerId) {
  try {
    console.log('Invoice PDF URL:', invoice.invoice_pdf);
    console.log('Hosted invoice URL:', invoice.hosted_invoice_url);
    
    const pdfBuffer = await downloadInvoicePdf(invoice.invoice_pdf);
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('Failed to download invoice PDF or PDF is empty');
      return;
    }
    
    console.log('PDF downloaded, size:', pdfBuffer.length, 'bytes');
    console.log('PDF header check:', pdfBuffer.slice(0, 4).toString() === '%PDF');
    
    const invoiceDate = new Date(invoice.created * 1000).toISOString().split('T')[0];
    const key = `invoices/${stripeCustomerId}/${invoiceDate}_${invoice.number}.pdf`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: 'storehere-invoices',
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        customerEmail: customerEmail,
        invoiceNumber: invoice.number,
        amount: invoice.amount_paid.toString(),
        stripeCustomerId: stripeCustomerId
      }
    }));
    
    console.log(`Invoice ${invoice.number} saved to S3: ${key}`);
    
  } catch (error) {
    console.error('Error saving invoice to S3:', error);
  }
}

// Download PDF helper (reuse existing)
async function downloadInvoicePdf(pdfUrl) {
  return new Promise((resolve, reject) => {
    const downloadFromUrl = (url, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }
      
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {}
      };

      if (urlObj.hostname.includes('stripe.com')) {
        options.headers['Authorization'] = `Bearer ${process.env.STRIPE_SECRET_KEY}`;
      }

      const req = https.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadFromUrl(res.headers.location, redirectCount + 1);
          return;
        }
        
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      
      req.on('error', reject);
      req.end();
    };
    
    downloadFromUrl(pdfUrl);
  });
}