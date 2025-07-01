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
    containerCapacity: 40,
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
  console.log('getContainers called for siteId:', siteId);
  
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `SITE#${siteId}`,
      ':sk': 'CONTAINER#'
    }
  };
  
  console.log('Query params:', params);
  
  try {
    const result = await dynamoDb.query(params).promise();
    console.log('DynamoDB query result:', result);
    console.log('Items returned:', result.Items);
    return result.Items;
  } catch (error) {
    console.error('Error getting containers:', error);
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
  
  // Add customer info if provided
  if (updates.customerName) {
    params.UpdateExpression += ', customerName = :customerName';
    params.ExpressionAttributeValues[':customerName'] = updates.customerName;
  }
  
  try {
    await dynamoDb.update(params).promise();
  } catch (error) {
    console.error('Error updating container:', error);
    throw error;
  }
};

export const createContainer = async (siteId, container) => {
  console.log('createContainer called with:', siteId, container);
  
  const item = {
    PK: `SITE#${siteId}`,
    SK: `CONTAINER#${container.number}`,
    type: 'container',
    number: container.number,
    status: 'available',
    customerId: null,
    customerName: null,
    monthlyRate: 0,
    rentStartDate: null,
    lastPaymentDate: null,
    lastPaymentAmount: 0,
    notes: ''
  };
  
  console.log('Creating item:', item);
  
  const params = {
    TableName: TABLE_NAME,
    Item: item
  };
  
  try {
    const result = await dynamoDb.put(params).promise();
    console.log('DynamoDB put result:', result);
    return item;
  } catch (error) {
    console.error('Error creating container:', error);
    throw error;
  }
};