import React, { useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes, confirmSignUp } from 'aws-amplify/auth';
import { ArrowLeft, CreditCard, Shield, Check } from 'lucide-react';

// Logo Component
function StoreLogo() {
  return (
    <div className="flex items-center gap-3 justify-center mb-8">
      <div className="relative">
        <div className="w-10 h-10 bg-orange-500 rounded-sm transform rotate-12"></div>
        <div className="w-10 h-10 bg-gray-700 rounded-sm absolute top-0 left-0 transform -rotate-6"></div>
        <div className="w-10 h-10 bg-gray-800 rounded-sm absolute top-0 left-0"></div>
      </div>
      <div>
        <span className="text-2xl font-bold text-gray-800">store</span>
        <span className="text-2xl font-bold text-orange-500">here</span>
        <div className="text-sm text-gray-500 uppercase tracking-wider">SELF STORAGE</div>
      </div>
    </div>
  );
}

function Payment() {
  const [user, setUser] = useState(null);
  const [userAttributes, setUserAttributes] = useState({});
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('verify'); // 'verify' or 'payment'
  const [confirmationCode, setConfirmationCode] = useState('');
  const [error, setError] = useState('');
  const [selectedContainer, setSelectedContainer] = useState(null);

  // Container options
  const containers = [
    { id: 1, size: '20ft Standard', dimensions: '2.6m(H) × 2.4m(W) × 6.0m(L)', price: 80, available: true },
    { id: 2, size: '20ft Standard', dimensions: '2.6m(H) × 2.4m(W) × 6.0m(L)', price: 80, available: true },
    { id: 3, size: '20ft Standard', dimensions: '2.6m(H) × 2.4m(W) × 6.0m(L)', price: 80, available: false },
  ];

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    // Check if coming from signup
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    
    if (username) {
      // User just signed up, needs confirmation
      setUserEmail(username);
      setStep('verify');
      setLoading(false);
      return;
    }
    
    try {
      // Check if already authenticated
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser(currentUser);
      setUserAttributes(attributes);
      setUserEmail(attributes.email);
      setStep('payment');
    } catch (error) {
      // Not authenticated, redirect to signup
      window.location.href = '/signup';
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await confirmSignUp({
        username: userEmail,
        confirmationCode
      });
      
      // After confirmation, check user status
      await checkUserStatus();
    } catch (error) {
      console.error('Confirmation error:', error);
      setError(error.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleContainerSelect = (container) => {
    setSelectedContainer(container);
  };

  const handlePayment = () => {
    // TODO: Integrate with Stripe
    console.log('Processing payment for container:', selectedContainer);
    alert('Stripe integration to be implemented');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Email Verification Step
  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <button 
              onClick={() => window.location.href = '/signup'}
              className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors mb-6"
            >
              <ArrowLeft size={20} />
              Back to Registration
            </button>

            <StoreLogo />
            
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
              Verify Your Email
            </h2>
            
            <p className="text-center text-gray-600 mb-6">
              We sent a confirmation code to {userAttributes.email || 'your email'}
            </p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleConfirmSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmation Code
                </label>
                <input
                  type="text"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 px-4 rounded-lg font-medium"
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Payment Step
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <StoreLogo />
            <div className="text-sm text-gray-600">
              Welcome, {userAttributes.given_name} {userAttributes.family_name}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Container Selection */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Select Your Container</h2>
            
            <div className="space-y-4">
              {containers.map((container) => (
                <div
                  key={container.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    !container.available 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                      : selectedContainer?.id === container.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                  }`}
                  onClick={() => container.available && handleContainerSelect(container)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-800">{container.size}</h3>
                      <p className="text-sm text-gray-600">{container.dimensions}</p>
                      <div className="mt-2">
                        <span className="text-2xl font-bold text-orange-500">${container.price}</span>
                        <span className="text-sm text-gray-600">/week inc GST</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {container.available ? (
                        <>
                          <span className="text-green-600 text-sm font-medium">Available</span>
                          {selectedContainer?.id === container.id && (
                            <Check className="w-6 h-6 text-orange-500 mt-2" />
                          )}
                        </>
                      ) : (
                        <span className="text-red-600 text-sm font-medium">Occupied</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Payment Details</h2>

            {selectedContainer ? (
              <div className="space-y-6">
                {/* Order Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Order Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Container: {selectedContainer.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Weekly Rate:</span>
                      <span>${selectedContainer.price} inc GST</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security Deposit:</span>
                      <span>$300</span>
                    </div>
                    <hr className="border-gray-300" />
                    <div className="flex justify-between font-semibold">
                      <span>Total Due Today:</span>
                      <span>${selectedContainer.price + 300}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Payment Method</h3>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                      <span className="font-medium">Credit/Debit Card</span>
                    </div>
                    
                    {/* Stripe Elements would go here */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Card Number
                        </label>
                        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                          Stripe Elements will be integrated here
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expiry Date
                          </label>
                          <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                            MM/YY
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            CVC
                          </label>
                          <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                            CVC
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Shield className="w-5 h-5" />
                  <span>Your payment is secured with 256-bit SSL encryption</span>
                </div>

                {/* Payment Button */}
                <button
                  onClick={handlePayment}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 px-4 rounded-lg font-semibold text-lg"
                >
                  Complete Payment (${selectedContainer.price + 300})
                </button>

                {/* Terms */}
                <p className="text-xs text-gray-500 text-center">
                  By completing this payment, you agree to our storage terms and conditions.
                  Your first payment covers the security deposit and first week of storage.
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <CreditCard className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-600">Please select a container to continue with payment</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Payment;