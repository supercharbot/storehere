import React, { useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { Container, User, Settings, LogOut, Package, CreditCard, FileText } from 'lucide-react';

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
      // Redirect to sign in if not authenticated
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
    { id: 'bookings', name: 'My Bookings', icon: Package },
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
                    <p className="text-2xl font-bold text-orange-600">0</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-800">Total Bookings</h3>
                    <p className="text-2xl font-bold text-blue-600">0</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors">
                    <Package className="text-orange-500 mb-2" size={24} />
                    <h4 className="font-medium text-gray-800">Book Container</h4>
                    <p className="text-sm text-gray-600">Reserve a new storage container</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('billing')}
                    className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <CreditCard className="text-orange-500 mb-2" size={24} />
                    <h4 className="font-medium text-gray-800">View Billing</h4>
                    <p className="text-sm text-gray-600">Check invoices and payments</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('profile')}
                    className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <Settings className="text-orange-500 mb-2" size={24} />
                    <h4 className="font-medium text-gray-800">Account Settings</h4>
                    <p className="text-sm text-gray-600">Update your profile and preferences</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('documents')}
                    className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <FileText className="text-orange-500 mb-2" size={24} />
                    <h4 className="font-medium text-gray-800">Documents</h4>
                    <p className="text-sm text-gray-600">Access contracts and agreements</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-6">My Bookings</h1>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600">No active bookings found. Ready to book your first container?</p>
                <button className="mt-4 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg font-medium">
                  Book Container
                </button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-6">Billing & Payments</h1>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600">No billing information available yet.</p>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-6">Documents</h1>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600">No documents available yet.</p>
              </div>
            </div>
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