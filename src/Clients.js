import React, { useState, useEffect } from 'react';
import { Search, Plus, X, User, Container, CreditCard, FileText, Download, Calendar, DollarSign, Eye } from 'lucide-react';
import AWS from 'aws-sdk';
import { getAllContainersWithCustomers, getContainerByCustomerEmail, getSiteById, getSites, getContainers, updateContainerWithCustomer } from './dynamodb';

// Configure AWS
AWS.config.update({
  region: process.env.REACT_APP_AWS_REGION,
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
});

const cognitoISP = new AWS.CognitoIdentityServiceProvider();
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

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
      const stripeCustomerId = await findUserStripeCustomerId(userEmail);
      
      if (!stripeCustomerId) {
        setInvoices([]);
        return;
      }
      
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
        amount: obj.Key.includes('620') || obj.Key.includes('I3E5FO7E-0001') ? 620 : 80
      })));
      
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

  const downloadInvoice = async (invoice) => {
    try {
      const params = {
        Bucket: 'storehere-invoices',
        Key: invoice.key,
        Expires: 60
      };
      
      const url = await s3.getSignedUrlPromise('getObject', params);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Failed to download invoice');
    }
  };

  if (loading) return <div className="p-4 text-center">Loading billing information...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="text-green-600" size={20} />
            <span className="text-sm font-medium text-green-800">Total Paid</span>
          </div>
          <div className="text-2xl font-bold text-green-900">${totalPaid}</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-blue-600" size={20} />
            <span className="text-sm font-medium text-blue-800">Next Payment</span>
          </div>
          <div className="text-lg font-semibold text-blue-900">{nextPayment}</div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <FileText className="text-gray-600" size={20} />
            <span className="text-sm font-medium text-gray-800">Total Invoices</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{invoices.length}</div>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Invoice History</h4>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No invoices found for this customer</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Invoice</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900">{invoice.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">${invoice.amount}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => downloadInvoice(invoice)}
                        className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Signature Component
function SignatureTab({ userId }) {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSignatures();
  }, [userId]);

  const fetchSignatures = async () => {
    try {
      setLoading(true);
      
      const params = {
        Bucket: 'storehere-agreements',
        Prefix: `agreements/${userId}_`,
      };
      
      const result = await s3.listObjectsV2(params).promise();
      setSignatures(result.Contents || []);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      setError('Failed to load signature documents');
    } finally {
      setLoading(false);
    }
  };

  const viewSignature = async (signature) => {
    try {
      const params = {
        Bucket: 'storehere-agreements',
        Key: signature.Key,
        Expires: 60
      };
      
      const url = await s3.getSignedUrlPromise('getObject', params);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error viewing signature:', error);
      alert('Failed to view signature document');
    }
  };

  if (loading) return <div className="p-4 text-center">Loading signature documents...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">Signature Documents</h4>
      
      {signatures.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No signature documents found for this customer</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Document</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Size</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {signatures.map((signature, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 text-sm text-gray-900">{signature.Key.split('/').pop()}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(signature.LastModified).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {(signature.Size / 1024).toFixed(1)} KB
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewSignature(signature)}
                      className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                      <Eye size={16} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Client Detail Modal
function ClientDetailModal({ client, onClose }) {
  const [activeTab, setActiveTab] = useState('details');
  const [containerInfo, setContainerInfo] = useState(null);
  const [siteInfo, setSiteInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContainerInfo();
  }, [client.email]);

  const fetchContainerInfo = async () => {
    try {
      setLoading(true);
      const container = await getContainerByCustomerEmail(client.email);
      setContainerInfo(container);
      
      if (container) {
        const siteId = container.PK.replace('SITE#', '');
        const site = await getSiteById(siteId);
        setSiteInfo(site);
      }
    } catch (error) {
      console.error('Error fetching container info:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'details', label: 'Client Details', icon: User },
    { id: 'container', label: 'Container Info', icon: Container },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'signatures', label: 'Signatures', icon: FileText }
  ];

  const getStatusColor = (status) => {
    const statusConfig = {
      'rented-paid': 'text-green-600 bg-green-100',
      'rented-unpaid': 'text-yellow-600 bg-yellow-100',
      'available': 'text-gray-600 bg-gray-100',
      'abandoned': 'text-red-600 bg-red-100'
    };
    return statusConfig[status] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            {client.given_name} {client.family_name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <div className="text-gray-900">{client.email}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Name</label>
                      <div className="text-gray-900">{client.given_name} {client.family_name}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Title</label>
                      <div className="text-gray-900">{client['custom:title'] || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Mobile Phone</label>
                      <div className="text-gray-900">{client.phone_number || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Home Phone</label>
                      <div className="text-gray-900">{client['custom:home_phone'] || 'N/A'}</div>
                    </div>
                    {client['custom:work_phone'] && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Work Phone</label>
                        <div className="text-gray-900">{client['custom:work_phone']}</div>
                      </div>
                    )}
                  </div>
                </div>

                {client['custom:company_name'] && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Company Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Company Name</label>
                        <div className="text-gray-900">{client['custom:company_name']}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">ABN</label>
                        <div className="text-gray-900">{client['custom:abn'] || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold mb-4">Address Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Home Address</label>
                      <div className="text-gray-900">{client['custom:home_address'] || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Home Postcode</label>
                      <div className="text-gray-900">{client['custom:home_postcode'] || 'N/A'}</div>
                    </div>
                    {client['custom:postal_address'] && (
                      <>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Postal Address</label>
                          <div className="text-gray-900">{client['custom:postal_address']}</div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Postal Postcode</label>
                          <div className="text-gray-900">{client['custom:postal_postcode'] || 'N/A'}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Authorised Contact Person</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Name</label>
                      <div className="text-gray-900">
                        {client['custom:acp_title']} {client['custom:acp_first_name']} {client['custom:acp_surname']}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <div className="text-gray-900">{client['custom:acp_email'] || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Address</label>
                      <div className="text-gray-900">{client['custom:acp_address'] || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Postcode</label>
                      <div className="text-gray-900">{client['custom:acp_postcode'] || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Home Phone</label>
                      <div className="text-gray-900">{client['custom:acp_home_phone'] || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Mobile Phone</label>
                      <div className="text-gray-900">{client['custom:acp_mobile_phone'] || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'container' && (
            <div className="space-y-6">
              {loading ? (
                <div className="text-center py-8">Loading container information...</div>
              ) : containerInfo ? (
                <>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Container Assignment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Container Number</label>
                        <div className="text-xl font-bold text-gray-900">{containerInfo.number}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Site Location</label>
                        <div className="text-gray-900">{siteInfo?.name || 'Loading...'}</div>
                        {siteInfo?.address && (
                          <div className="text-sm text-gray-600">{siteInfo.address}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Status</label>
                        <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(containerInfo.status)}`}>
                          {containerInfo.status?.replace('-', ' ').toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Rent Start Date</label>
                        <div className="text-gray-900">
                          {containerInfo.rentStartDate ? new Date(containerInfo.rentStartDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Subscription Status</label>
                        <div className="text-gray-900 capitalize">{containerInfo.subscriptionStatus || 'N/A'}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Security Bond Status</label>
                        <div className="text-gray-900 capitalize">{containerInfo.securityBondStatus || 'N/A'}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Last Payment Date</label>
                        <div className="text-gray-900">
                          {containerInfo.lastPaymentDate ? new Date(containerInfo.lastPaymentDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Next Due Date</label>
                        <div className="text-gray-900">
                          {containerInfo.nextDueDate ? new Date(containerInfo.nextDueDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      {containerInfo.overdueSince && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Overdue Since</label>
                          <div className="text-red-600 font-medium">
                            {new Date(containerInfo.overdueSince).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-700">Stripe Customer ID</label>
                        <div className="text-gray-900 font-mono text-sm">
                          {containerInfo.stripeCustomerId || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">No container assigned to this customer</div>
              )}
            </div>
          )}

          {activeTab === 'billing' && (
            <BillingTab userEmail={client.email} userId={client.sub} />
          )}

          {activeTab === 'signatures' && (
            <SignatureTab userId={client.sub} />
          )}
        </div>
      </div>
    </div>
  );
}

// Create Client Modal
function CreateClientModal({ onClose, onClientCreated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sites, setSites] = useState([]);
  const [containers, setContainers] = useState([]);
  const [formData, setFormData] = useState({
    given_name: '',
    family_name: '',
    email: '',
    phone_number: '',
    selectedSite: '',
    selectedContainer: ''
  });

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (formData.selectedSite) {
      fetchContainers(formData.selectedSite);
    }
  }, [formData.selectedSite]);

  const fetchSites = async () => {
    try {
      const sitesData = await getSites();
      setSites(sitesData || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const fetchContainers = async (siteId) => {
    try {
      const containersData = await getContainers(siteId);
      const availableContainers = containersData.filter(container => 
        container.type === 'container' && 
        (!container.customerEmail || container.customerEmail === '') &&
        (container.subscriptionStatus === 'inactive' || !container.subscriptionStatus)
      );
      setContainers(availableContainers);
    } catch (error) {
      console.error('Error fetching containers:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const createStripeCustomer = async (email, name, tempPassword) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/create-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          tempPassword,
          priceId: process.env.REACT_APP_CONTAINER_STORAGE_PRICE_ID
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create Stripe customer');
      }

      const data = await response.json();
      return data.customerId;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.given_name || !formData.family_name || !formData.email || 
        !formData.phone_number || !formData.selectedSite || !formData.selectedContainer) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      
      await cognitoISP.adminCreateUser({
        UserPoolId: process.env.REACT_APP_USER_POOL_ID,
        Username: formData.email,
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: formData.email },
          { Name: 'given_name', Value: formData.given_name },
          { Name: 'family_name', Value: formData.family_name },
          { Name: 'phone_number', Value: formData.phone_number.startsWith('+') ? formData.phone_number : `+61${formData.phone_number.replace(/^0/, '')}` },
          { Name: 'email_verified', Value: 'true' }
        ]
      }).promise();

      const stripeCustomerId = await createStripeCustomer(
        formData.email, 
        `${formData.given_name} ${formData.family_name}`,
        tempPassword
      );

      await updateContainerWithCustomer(formData.selectedSite, formData.selectedContainer, {
        customerEmail: formData.email,
        stripeCustomerId: stripeCustomerId,
        subscriptionStatus: 'active',
        securityBondStatus: 'paid',
        status: 'rented-paid',
        rentStartDate: new Date().toISOString(),
        lastPaymentDate: new Date().toISOString(),
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

      alert(`Client created successfully!\nLogin credentials have been sent to ${formData.email}`);
      
      onClientCreated();
      onClose();
    } catch (error) {
      console.error('Error creating client:', error);
      setError(error.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Create New Client</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                value={formData.given_name}
                onChange={(e) => handleInputChange('given_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={formData.family_name}
                onChange={(e) => handleInputChange('family_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => handleInputChange('phone_number', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="0412345678"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site *</label>
            <select
              value={formData.selectedSite}
              onChange={(e) => handleInputChange('selectedSite', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Select a site</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name} - {site.address}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Container *</label>
            <select
              value={formData.selectedContainer}
              onChange={(e) => handleInputChange('selectedContainer', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              disabled={!formData.selectedSite}
            >
              <option value="">Select a container</option>
              {containers.map(container => (
                <option key={container.number} value={container.number}>
                  {container.number}
                </option>
              ))}
            </select>
          </div>

          {formData.selectedSite && containers.length === 0 && (
            <div className="text-sm text-yellow-600">No available containers at this site</div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white py-2 rounded-lg"
            >
              {loading ? 'Creating...' : 'Create Client'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Clients() {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [containersData, setContainersData] = useState([]);

  useEffect(() => {
    fetchClients();
    fetchContainersData();
  }, []);

  useEffect(() => {
    filterClients();
  }, [searchTerm, clients, containersData]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const params = {
        UserPoolId: process.env.REACT_APP_USER_POOL_ID
      };

      const result = await cognitoISP.listUsers(params).promise();
      
      const formattedClients = [];
      
      for (const user of result.Users) {
        try {
          const groupsResult = await cognitoISP.adminListGroupsForUser({
            UserPoolId: process.env.REACT_APP_USER_POOL_ID,
            Username: user.Username
          }).promise();
          
          const isAdmin = groupsResult.Groups.some(group => group.GroupName === 'Admins');
          
          if (!isAdmin) {
            const attributes = {};
            user.Attributes.forEach(attr => {
              attributes[attr.Name] = attr.Value;
            });
            
            formattedClients.push({
              ...attributes,
              username: user.Username,
              status: user.UserStatus,
              created: user.UserCreateDate,
              lastModified: user.UserLastModifiedDate
            });
          }
        } catch (error) {
          console.error('Error checking user groups for:', user.Username, error);
        }
      }

      setClients(formattedClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setError('Failed to load clients. Please check your permissions.');
    } finally {
      setLoading(false);
    }
  };

  const fetchContainersData = async () => {
    try {
      const containers = await getAllContainersWithCustomers();
      setContainersData(containers);
    } catch (error) {
      console.error('Error fetching containers data:', error);
    }
  };

  const handleClientCreated = () => {
    fetchClients();
    fetchContainersData();
  };

  const filterClients = () => {
    if (!searchTerm.trim()) {
      setFilteredClients(clients);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = clients.filter(client => {
      const basicMatch = [
        client.email,
        client.given_name,
        client.family_name,
        client['custom:company_name'],
        client.phone_number
      ].some(field => field?.toLowerCase().includes(term));

      const container = containersData.find(c => c.customerEmail === client.email);
      const containerMatch = container?.number?.toLowerCase().includes(term);

      return basicMatch || containerMatch;
    });

    setFilteredClients(filtered);
  };

  const getClientContainer = (email) => {
    return containersData.find(container => container.customerEmail === email);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONFIRMED': return 'text-green-600 bg-green-100';
      case 'UNCONFIRMED': return 'text-yellow-600 bg-yellow-100';
      case 'FORCE_CHANGE_PASSWORD': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading clients...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Client Management</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {filteredClients.length} of {clients.length} clients
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={20} />
            Create Client
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by container ID, name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Email</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Container</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Company</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredClients.map((client) => {
              const container = getClientContainer(client.email);
              return (
                <tr key={client.sub} className="hover:bg-gray-50 h-16">
                  <td className="px-6 py-4 h-16">
                    <div className="font-medium text-gray-900 truncate">
                      {client.given_name} {client.family_name}
                    </div>
                    <div className="text-sm text-gray-500 truncate">{client['custom:title'] || ''}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 h-16">
                    <div className="truncate">{client.email}</div>
                  </td>
                  <td className="px-6 py-4 h-16">
                    {container ? (
                      <div>
                        <div className="font-medium text-gray-900">{container.number}</div>
                        <div className="text-sm text-gray-500 truncate">
                          {container.subscriptionStatus === 'active' ? 'Active' : 
                           container.subscriptionStatus === 'past_due' ? 'Past Due' : 
                           container.subscriptionStatus || 'Inactive'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">No container</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 h-16">
                    <div className="truncate">{client['custom:company_name'] || 'Personal'}</div>
                  </td>
                  <td className="px-6 py-4 h-16">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(client.status)}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 h-16">
                    <button
                      onClick={() => setSelectedClient(client)}
                      className="text-orange-600 hover:text-orange-700 font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredClients.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchTerm ? 'No clients found matching your search.' : 'No clients found.'}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateClientModal 
          onClose={() => setShowCreateModal(false)}
          onClientCreated={handleClientCreated}
        />
      )}

      {selectedClient && (
        <ClientDetailModal 
          client={selectedClient} 
          onClose={() => setSelectedClient(null)} 
        />
      )}
    </div>
  );
}

export default Clients;