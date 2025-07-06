import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'storage-management';

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
  
  if (paymentData.rentStartDate) {
    updateExpr.push('rentStartDate = :rentStart');
    exprValues[':rentStart'] = paymentData.rentStartDate;
  }
  
  // Only proceed if we have something to update
  if (updateExpr.length === 0) {
    console.log('No updates to perform');
    return;
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
  
  await dynamoDb.send(new UpdateCommand(params));
};