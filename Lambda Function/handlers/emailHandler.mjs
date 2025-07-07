import https from 'https';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'ap-southeast-2' });

// Helper function to get Stripe data
const getStripeData = async (path) => {
  const options = {
    hostname: 'api.stripe.com',
    port: 443,
    path: path,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
};

// Download invoice PDF and save to S3
const downloadAndSaveInvoice = async (invoice) => {
  try {
    // Get customer to extract user ID
    const customer = await getStripeData(`/v1/customers/${invoice.customer}`);
    const userId = customer.metadata?.userId;
    
    if (!userId) {
      console.log('No user ID found in customer metadata - skipping invoice save');
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

export const sendInitialPaymentEmail = async (paymentIntent, invoice = null) => {
  try {
    const customer = await getStripeData(`/v1/customers/${paymentIntent.customer}`);

    // If no invoice provided, try to find the invoice created by the payment link
    let actualInvoice = invoice;
    if (!actualInvoice) {
      // Get latest invoice for this customer
      const invoices = await getStripeData(`/v1/invoices?customer=${paymentIntent.customer}&limit=1`);
      if (invoices.data && invoices.data.length > 0) {
        actualInvoice = invoices.data[0];
      }
    }

    // Download and save invoice PDF if available
    if (actualInvoice && actualInvoice.invoice_pdf) {
      await downloadAndSaveInvoice(actualInvoice);
    }

    const invoiceLink = actualInvoice ? `<p><a href="${actualInvoice.hosted_invoice_url}">Download Invoice</a></p>` : '';

    const emailParams = {
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [customer.email] },
      Message: {
        Subject: { Data: 'Welcome to StoreHere - Payment Confirmed' },
        Body: {
          Html: {
            Data: `
              <h2>Welcome to StoreHere!</h2>
              <p>Dear ${customer.name},</p>
              <p>Thank you for your payment of $${(paymentIntent.amount / 100).toFixed(2)}. Your container rental is now active!</p>
              <p><strong>Container:</strong> ${paymentIntent.metadata.containerNumber}</p>
              <p><strong>Site:</strong> ${paymentIntent.metadata.siteId}</p>
              <p><strong>Payment Breakdown:</strong></p>
              <ul>
                <li>Security Bond: $300.00</li>
                <li>Storage Rental (${paymentIntent.metadata.weeksPaid} weeks): $${((paymentIntent.amount - 30000) / 100).toFixed(2)}</li>
              </ul>
              ${invoiceLink}
              <p>Automatic weekly billing of $80 will begin after your prepaid period expires.</p>
              <p>Best regards,<br>StoreHere Team</p>
            `
          }
        }
      }
    };

    await sesClient.send(new SendEmailCommand(emailParams));
    console.log(`Initial payment email sent to ${customer.email}`);
  } catch (error) {
    console.error('Error sending initial payment email:', error);
  }
};

export const sendSuccessPaymentEmail = async (invoice) => {
  try {
    const subscription = await getStripeData(`/v1/subscriptions/${invoice.subscription}`);
    const customer = await getStripeData(`/v1/customers/${invoice.customer}`);
    
    // Download and save invoice PDF
    if (invoice.invoice_pdf) {
      await downloadAndSaveInvoice(invoice);
    }
    
    // Use customer email for name if userEmail not in metadata
    const customerName = subscription.metadata?.userEmail?.split('@')[0] || customer.email?.split('@')[0] || customer.name;

    const emailParams = {
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [customer.email] },
      Message: {
        Subject: { Data: 'Payment Confirmation - StoreHere' },
        Body: {
          Html: {
            Data: `
              <h2>Payment Confirmation</h2>
              <p>Dear ${customerName},</p>
              <p>Thank you! Your weekly payment of $${(invoice.amount_paid / 100).toFixed(2)} has been processed successfully.</p>
              <p><strong>Invoice #:</strong> ${invoice.number}</p>
              <p><strong>Amount:</strong> $${(invoice.amount_paid / 100).toFixed(2)}</p>
              ${subscription.metadata?.containerNumber ? `<p><strong>Container:</strong> ${subscription.metadata.containerNumber}</p>` : ''}
              <p><a href="${invoice.hosted_invoice_url}">View Invoice</a></p>
              <p>Your next payment will be processed automatically in 7 days.</p>
              <p>Best regards,<br>StoreHere Team</p>
            `
          }
        }
      }
    };

    await sesClient.send(new SendEmailCommand(emailParams));
    console.log(`Success payment email sent to ${customer.email}`);
  } catch (error) {
    console.error('Error sending success email:', error);
  }
};

export const sendFailedPaymentEmail = async (invoice) => {
  try {
    const customer = await getStripeData(`/v1/customers/${invoice.customer}`);

    const emailParams = {
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [customer.email] },
      Message: {
        Subject: { Data: 'Payment Failed - StoreHere' },
        Body: {
          Html: {
            Data: `
              <h2>Payment Failed</h2>
              <p>Dear ${customer.name},</p>
              <p>We couldn't process your payment of $${(invoice.amount_due / 100).toFixed(2)}.</p>
              <p>Please update your payment method to avoid service interruption.</p>
              <p><a href="${invoice.hosted_invoice_url}">Update Payment Method</a></p>
              <p>Best regards,<br>StoreHere Team</p>
            `
          }
        }
      }
    };

    await sesClient.send(new SendEmailCommand(emailParams));
    console.log(`Failed payment email sent to ${customer.email}`);
  } catch (error) {
    console.error('Error sending failed payment email:', error);
  }
};