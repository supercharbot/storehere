import React, { useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { Container, User, Settings, LogOut, CreditCard, FileText, Download, Calendar, DollarSign } from 'lucide-react';
import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: process.env.REACT_APP_AWS_REGION,
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// Logo Component
function StoreLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-8 h-8 bg-orange-500 rounded-sm transform rotate-12"></div>
        <div className="w-8 h-8 bg-gray-700 rounded-sm absolute top-0 left-0 transform -rotate-6"></div>
        <div className="w-8 h-8 bg-gray-800 rounded-sm absolute top-0 left-0"></div>
      </div>
      <div>
        <span className="text-xl font-bold text-gray-800">store</span>
        <span className="text-xl font-bold text-orange-500">here</span>
        <div className="text-xs text-gray-500 uppercase tracking-wider">SELF STORAGE</div>
      </div>
    </div>
  );
}

// Billing Component
function BillingTab({ userEmail, userId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalPaid, setTotalPaid] = useState(0);
  const [nextPayment, setNextPayment] = useState('--');

  useEffect(() => {
    fetchBillingData();
  }, [userEmail]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      // Skip API call for now, go straight to S3
      await fetchInvoicesFromS3();
      await fetchPaymentInfo();
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoicesFromS3 = async () => {
    try {
      console.log('Looking for invoices with userId:', userId, 'userEmail:', userEmail);
      
      // Step 1: Find user's container in DynamoDB to get Stripe customer ID
      const stripeCustomerId = await findUserStripeCustomerId(userEmail);
      
      if (!stripeCustomerId) {
        console.log('No Stripe customer ID found for user');
        setInvoices([]);
        return;
      }
      
      console.log('Found Stripe customer ID:', stripeCustomerId);
      
      // Step 2: List invoices in S3 for this customer
      const params = {
        Bucket: 'storehere-invoices',
        Prefix: `invoices/${stripeCustomerId}/`,
      };
      
      const result = await s3.listObjectsV2(params).promise();
      const userInvoices = result.Contents || [];
      
      setInvoices(userInvoices.map(obj => ({
        key: obj.Key,
        date: obj.LastModified,
        size: obj.Size,
        name: obj.Key.split('/').pop(),
        stripeCustomerId: stripeCustomerId,
        amount: obj.Key.includes('620') || obj.Key.includes('I3E5FO7E-0001') ? 620 : 80 // Determine amount from filename
      })));
      
      // Calculate total paid
      const total = userInvoices.reduce((sum, invoice) => {
        const amount = invoice.Key.includes('620') || invoice.Key.includes('I3E5FO7E-0001') ? 620 : 80;
        return sum + amount;
      }, 0);
      setTotalPaid(total);
    } catch (error) {
      console.error('Error fetching from S3:', error);
      setError('Failed to load invoices from storage');
    }
  };

  // Fetch payment info from DynamoDB
  const fetchPaymentInfo = async () => {
    try {
      const params = {
        TableName: 'storage-management',
        FilterExpression: 'customerEmail = :email',
        ExpressionAttributeValues: {
          ':email': userEmail
        }
      };
      
      const result = await dynamoDb.scan(params).promise();
      
      if (result.Items && result.Items.length > 0) {
        const container = result.Items[0];
        if (container.nextDueDate) {
          setNextPayment(new Date(container.nextDueDate).toLocaleDateString());
        }
      }
    } catch (error) {
      console.error('Error fetching payment info:', error);
    }
  };

  // Find user's Stripe customer ID from DynamoDB
  const findUserStripeCustomerId = async (email) => {
    try {
      const params = {
        TableName: 'storage-management',
        FilterExpression: 'customerEmail = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      };
      
      const result = await dynamoDb.scan(params).promise();
      
      if (result.Items && result.Items.length > 0) {
        return result.Items[0].stripeCustomerId;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding Stripe customer ID:', error);
      return null;
    }
  };

  const downloadInvoice = async (key) => {
    try {
      const params = {
        Bucket: 'storehere-invoices',
        Key: key
      };
      
      const signedUrl = await s3.getSignedUrlPromise('getObject', {
        ...params,
        Expires: 3600 // 1 hour
      });
      
      window.open(signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Failed to download invoice');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading billing information...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">{error}</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Billing & Payments</h1>
      
      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-gray-900">${totalPaid}.00</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Next Payment</p>
              <p className="text-2xl font-bold text-gray-900">{nextPayment}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Invoice History</h3>
        </div>
        <div className="overflow-x-auto">
          {invoices.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.name || `Invoice ${index + 1}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${invoice.amount}.00
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Paid
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => downloadInvoice(invoice.key)}
                        className="text-orange-600 hover:text-orange-900 flex items-center gap-1"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
              <p className="mt-1 text-sm text-gray-500">No billing history available yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Documents Component
function DocumentsTab({ userId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // List objects with user ID prefix to find timestamped files
      const params = {
        Bucket: 'storehere-agreements',
        Prefix: `agreements/${userId}`
      };
      
      const result = await s3.listObjectsV2(params).promise();
      
      if (result.Contents && result.Contents.length > 0) {
        const docs = result.Contents.map(obj => ({
          name: 'Storage Agreement',
          type: 'PDF',
          key: obj.Key,
          description: 'Signed storage container agreement',
          date: obj.LastModified
        }));
        setDocuments(docs);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (key) => {
    try {
      const params = {
        Bucket: 'storehere-agreements',
        Key: key
      };
      
      const signedUrl = await s3.getSignedUrlPromise('getObject', {
        ...params,
        Expires: 3600 // 1 hour
      });
      
      window.open(signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading documents...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">{error}</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Documents</h1>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Your Documents</h3>
          <p className="mt-1 text-sm text-gray-500">
            Download copies of your agreements and important documents.
          </p>
        </div>
        
        <div className="p-6">
          {documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <h4 className="text-sm font-medium text-gray-900">{doc.name}</h4>
                      <p className="text-sm text-gray-500">{doc.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadDocument(doc.key)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
              <p className="mt-1 text-sm text-gray-500">
                No documents available yet. Your signed agreements will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientManagement() {
  const [user, setUser] = useState(null);
  const [userAttributes, setUserAttributes] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser(currentUser);
      setUserAttributes(attributes);
    } catch (error) {
      console.error('Auth error:', error);
      window.location.href = '/signin';
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/home';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: Container },
    { id: 'billing', name: 'Billing', icon: CreditCard },
    { id: 'documents', name: 'Documents', icon: FileText },
    { id: 'profile', name: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <StoreLogo />
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                Welcome, {userAttributes.given_name || 'Client'}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'dashboard' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-6">Client Dashboard</h1>
              
              {/* Welcome Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Welcome to StoreHere, {userAttributes.given_name}!
                </h2>
                <p className="text-gray-600 mb-4">
                  Manage your storage containers and account from this dashboard.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-800">Active Containers</h3>
                    <p className="text-2xl font-bold text-orange-600">1</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-800">Monthly Payment</h3>
                    <p className="text-2xl font-bold text-blue-600">$320</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-800">Account Status</h3>
                    <p className="text-lg font-semibold text-green-600">Active</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <button 
                    onClick={() => setActiveTab('billing')}
                    className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <CreditCard className="text-orange-500 mb-2" size={24} />
                    <h4 className="font-medium text-gray-800">View Billing</h4>
                    <p className="text-sm text-gray-600">Check invoices and payments</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('documents')}
                    className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <FileText className="text-orange-500 mb-2" size={24} />
                    <h4 className="font-medium text-gray-800">Documents</h4>
                    <p className="text-sm text-gray-600">Access contracts and agreements</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('profile')}
                    className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <Settings className="text-orange-500 mb-2" size={24} />
                    <h4 className="font-medium text-gray-800">Account Settings</h4>
                    <p className="text-sm text-gray-600">Update your profile and preferences</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <BillingTab 
              userEmail={userAttributes.email} 
              userId={user?.userId || user?.username}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsTab userId={user?.userId || user?.username} />
          )}

          {activeTab === 'profile' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-6">Profile Settings</h1>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <p className="text-gray-900">{userAttributes.given_name} {userAttributes.family_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p className="text-gray-900">{userAttributes.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <p className="text-gray-900">{userAttributes.phone_number || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Details</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Account Type</label>
                        <p className="text-gray-900">{userAttributes['custom:company_name'] ? 'Business' : 'Personal'}</p>
                      </div>
                      {userAttributes['custom:company_name'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Company</label>
                          <p className="text-gray-900">{userAttributes['custom:company_name']}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Member Since</label>
                        <p className="text-gray-900">Recently Joined</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClientManagement;