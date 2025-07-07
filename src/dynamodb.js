import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: process.env.REACT_APP_AWS_REGION,
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'storage-management';

// Site operations
export const getSites = async () => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: {
      ':sk': 'METADATA'
    }
  };
  
  try {
    const result = await dynamoDb.scan(params).promise();
    return result.Items;
  } catch (error) {
    console.error('Error getting sites:', error);
    throw error;
  }
};

export const createSite = async (site) => {
  const siteId = site.name.toLowerCase().replace(/\s+/g, '-');
  const item = {
    PK: `SITE#${siteId}`,
    SK: 'METADATA',
    type: 'site',
    id: siteId,
    name: site.name,
    address: site.address,
    createdAt: new Date().toISOString()
  };
  
  const params = {
    TableName: TABLE_NAME,
    Item: item
  };
  
  try {
    await dynamoDb.put(params).promise();
    return item;
  } catch (error) {
    console.error('Error creating site:', error);
    throw error;
  }
};

export const deleteSite = async (siteId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SITE#${siteId}`,
      SK: 'METADATA'
    }
  };
  
  try {
    await dynamoDb.delete(params).promise();
  } catch (error) {
    console.error('Error deleting site:', error);
    throw error;
  }
};

// Container operations
export const getContainers = async (siteId) => {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `SITE#${siteId}`,
      ':sk': 'CONTAINER#'
    }
  };
  
  try {
    const result = await dynamoDb.query(params).promise();
    return result.Items;
  } catch (error) {
    console.error('Error getting containers:', error);
    throw error;
  }
};

export const createContainer = async (siteId, container) => {
  const item = {
    PK: `SITE#${siteId}`,
    SK: `CONTAINER#${container.number}`,
    type: 'container',
    number: container.number,
    status: 'available',
    
    // Payment tracking
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    securityBondStatus: 'unpaid',
    subscriptionStatus: 'inactive',
    
    // Dates
    rentStartDate: null,
    lastPaymentDate: null,
    nextDueDate: null,
    overdueSince: null,
    
    createdAt: new Date().toISOString()
  };
  
  const params = {
    TableName: TABLE_NAME,
    Item: item
  };
  
  try {
    await dynamoDb.put(params).promise();
    return item;
  } catch (error) {
    console.error('Error creating container:', error);
    throw error;
  }
};

export const updateContainer = async (siteId, containerNumber, updates) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SITE#${siteId}`,
      SK: `CONTAINER#${containerNumber}`
    },
    UpdateExpression: 'SET #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': updates.status
    }
  };
  
  try {
    await dynamoDb.update(params).promise();
  } catch (error) {
    console.error('Error updating container:', error);
    throw error;
  }
};

// Payment operations (used by webhook)
export const updateContainerPayment = async (siteId, containerNumber, paymentData) => {
  const updateExpr = [];
  const exprValues = {};
  const exprNames = {};
  
  if (paymentData.stripeCustomerId) {
    updateExpr.push('stripeCustomerId = :customerId');
    exprValues[':customerId'] = paymentData.stripeCustomerId;
  }
  
  if (paymentData.stripeSubscriptionId) {
    updateExpr.push('stripeSubscriptionId = :subscriptionId');
    exprValues[':subscriptionId'] = paymentData.stripeSubscriptionId;
  }
  
  if (paymentData.securityBondStatus) {
    updateExpr.push('securityBondStatus = :bondStatus');
    exprValues[':bondStatus'] = paymentData.securityBondStatus;
  }
  
  if (paymentData.subscriptionStatus) {
    updateExpr.push('subscriptionStatus = :subStatus');
    exprValues[':subStatus'] = paymentData.subscriptionStatus;
  }
  
  if (paymentData.status) {
    updateExpr.push('#status = :containerStatus');
    exprNames['#status'] = 'status';
    exprValues[':containerStatus'] = paymentData.status;
  }
  
  if (paymentData.lastPaymentDate) {
    updateExpr.push('lastPaymentDate = :paymentDate');
    exprValues[':paymentDate'] = paymentData.lastPaymentDate;
  }
  
  if (paymentData.nextDueDate) {
    updateExpr.push('nextDueDate = :nextDue');
    exprValues[':nextDue'] = paymentData.nextDueDate;
  }
  
  if (paymentData.overdueSince !== undefined) {
    updateExpr.push('overdueSince = :overdue');
    exprValues[':overdue'] = paymentData.overdueSince;
  }
  
  if (paymentData.rentStartDate) {
    updateExpr.push('rentStartDate = :rentStart');
    exprValues[':rentStart'] = paymentData.rentStartDate;
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SITE#${siteId}`,
      SK: `CONTAINER#${containerNumber}`
    },
    UpdateExpression: `SET ${updateExpr.join(', ')}`,
    ExpressionAttributeValues: exprValues
  };
  
  if (Object.keys(exprNames).length > 0) {
    params.ExpressionAttributeNames = exprNames;
  }
  
  try {
    await dynamoDb.update(params).promise();
  } catch (error) {
    console.error('Error updating container payment:', error);
    throw error;
  }
};

// Find container by Stripe subscription ID (for webhook)
export const getContainerBySubscription = async (subscriptionId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'stripeSubscriptionId = :subId',
    ExpressionAttributeValues: {
      ':subId': subscriptionId
    }
  };
  
  try {
    const result = await dynamoDb.scan(params).promise();
    return result.Items[0] || null;
  } catch (error) {
    console.error('Error finding container by subscription:', error);
    throw error;
  }
};

// Find container by Stripe customer ID (for webhook)
export const getContainerByCustomer = async (customerId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'stripeCustomerId = :custId',
    ExpressionAttributeValues: {
      ':custId': customerId
    }
  };
  
  try {
    const result = await dynamoDb.scan(params).promise();
    return result.Items[0] || null;
  } catch (error) {
    console.error('Error finding container by customer:', error);
    throw error;
  }
};

// Check for overdue containers
export const getOverdueContainers = async () => {
  const now = new Date().toISOString();
  
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'nextDueDate < :now AND subscriptionStatus = :active',
    ExpressionAttributeValues: {
      ':now': now,
      ':active': 'active'
    }
  };
  
  try {
    const result = await dynamoDb.scan(params).promise();
    return result.Items;
  } catch (error) {
    console.error('Error getting overdue containers:', error);
    throw error;
  }
};

// Get all containers that have customers assigned
export const getAllContainersWithCustomers = async () => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'attribute_exists(customerEmail) AND customerEmail <> :empty',
    ExpressionAttributeValues: {
      ':empty': ''
    }
  };
  
  try {
    const result = await dynamoDb.scan(params).promise();
    return result.Items;
  } catch (error) {
    console.error('Error getting containers with customers:', error);
    throw error;
  }
};

// Find container by customer email
export const getContainerByCustomerEmail = async (customerEmail) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'customerEmail = :email',
    ExpressionAttributeValues: {
      ':email': customerEmail
    }
  };
  
  try {
    const result = await dynamoDb.scan(params).promise();
    return result.Items[0] || null;
  } catch (error) {
    console.error('Error finding container by customer email:', error);
    throw error;
  }
};

// Get site information by site ID
export const getSiteById = async (siteId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SITE#${siteId}`,
      SK: 'METADATA'
    }
  };
  
  try {
    const result = await dynamoDb.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('Error getting site by ID:', error);
    throw error;
  }
};

// Add customerEmail field to container updates
export const updateContainerWithCustomer = async (siteId, containerNumber, customerData) => {
  const updateExpr = [];
  const exprValues = {};
  const exprNames = {};
  
  if (customerData.customerEmail) {
    updateExpr.push('customerEmail = :email');
    exprValues[':email'] = customerData.customerEmail;
  }
  
  if (customerData.stripeCustomerId) {
    updateExpr.push('stripeCustomerId = :customerId');
    exprValues[':customerId'] = customerData.stripeCustomerId;
  }
  
  if (customerData.stripeSubscriptionId) {
    updateExpr.push('stripeSubscriptionId = :subscriptionId');
    exprValues[':subscriptionId'] = customerData.stripeSubscriptionId;
  }
  
  if (customerData.securityBondStatus) {
    updateExpr.push('securityBondStatus = :bondStatus');
    exprValues[':bondStatus'] = customerData.securityBondStatus;
  }
  
  if (customerData.subscriptionStatus) {
    updateExpr.push('subscriptionStatus = :subStatus');
    exprValues[':subStatus'] = customerData.subscriptionStatus;
  }
  
  if (customerData.status) {
    updateExpr.push('#status = :containerStatus');
    exprNames['#status'] = 'status';
    exprValues[':containerStatus'] = customerData.status;
  }
  
  if (customerData.lastPaymentDate) {
    updateExpr.push('lastPaymentDate = :paymentDate');
    exprValues[':paymentDate'] = customerData.lastPaymentDate;
  }
  
  if (customerData.nextDueDate) {
    updateExpr.push('nextDueDate = :nextDue');
    exprValues[':nextDue'] = customerData.nextDueDate;
  }
  
  if (customerData.rentStartDate) {
    updateExpr.push('rentStartDate = :rentStart');
    exprValues[':rentStart'] = customerData.rentStartDate;
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SITE#${siteId}`,
      SK: `CONTAINER#${containerNumber}`
    },
    UpdateExpression: `SET ${updateExpr.join(', ')}`,
    ExpressionAttributeValues: exprValues
  };
  
  if (Object.keys(exprNames).length > 0) {
    params.ExpressionAttributeNames = exprNames;
  }
  
  try {
    await dynamoDb.update(params).promise();
  } catch (error) {
    console.error('Error updating container with customer:', error);
    throw error;
  }
};