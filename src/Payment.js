import React, { useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes, confirmSignUp } from 'aws-amplify/auth';
import { getSites, getContainers } from './dynamodb';
import { ArrowLeft } from 'lucide-react';

// Your API Gateway endpoint
const API_ENDPOINT = process.env.REACT_APP_API_URL;

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

// Waiting List Component
function WaitingList() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <StoreLogo />
        
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              Sorry, We're Currently Full
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              All our storage containers are currently occupied, but we'd love to notify you when one becomes available.
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-800 mb-2">Join Our Waiting List</h3>
            <p className="text-orange-700 mb-4">
              We'll email you as soon as a container becomes available. Most customers get notified within 2-4 weeks.
            </p>
            
            <button className="w-full bg-orange-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-orange-600 transition-colors">
              Join Waiting List
            </button>
          </div>

          <div className="text-gray-600">
            <p className="mb-2">Need immediate storage? We can help you find alternatives.</p>
            <p>
              Contact us at{' '}
              <a href="mailto:support@storehere.com" className="text-orange-600 hover:underline">
                support@storehere.com
              </a>{' '}
              or call us at{' '}
              <a href="tel:1300123456" className="text-orange-600 hover:underline">
                1300 123 456
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Payment Form Component
function PaymentForm({ container, userAttributes, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [billingFrequency, setBillingFrequency] = useState('weekly');

  const billingOptions = [
    { value: 'weekly', label: 'Weekly', price: '$85', description: 'Charged every week' },
    { value: 'fortnightly', label: 'Fortnightly', price: '$170', description: 'Charged every 2 weeks' },
    { value: 'monthly', label: 'Monthly', price: '$340', description: 'Charged monthly' }
  ];

  const createCheckoutSession = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINT}/create-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billingFrequency,
          userEmail: userAttributes.email,
          userName: `${userAttributes.given_name} ${userAttributes.family_name}`,
          containerId: container.id,
          siteId: container.siteId,
          userAttributes
        }),
      });

      const data = await response.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        onError('Failed to initialize payment');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      onError('Failed to initialize payment');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Complete Your Payment</h2>
        
        {/* Container Details */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-orange-800 mb-2">Container Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-orange-700">
            <div>
              <span className="font-medium">Container:</span> #{container.number}
            </div>
            <div>
              <span className="font-medium">Location:</span> {container.siteName}
            </div>
            <div className="md:col-span-2">
              <span className="font-medium">Initial Payment:</span> $640 
              <span className="text-sm text-orange-600 ml-2">(4 weeks rent + $300 security bond)</span>
            </div>
          </div>
        </div>

        {/* Billing Frequency Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Choose Your Billing Frequency</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {billingOptions.map((option) => (
              <label key={option.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="billingFrequency"
                  value={option.value}
                  checked={billingFrequency === option.value}
                  onChange={(e) => setBillingFrequency(e.target.value)}
                  className="sr-only"
                />
                <div className={`border-2 rounded-lg p-4 text-center transition-all ${
                  billingFrequency === option.value
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="font-semibold text-gray-800">{option.label}</div>
                  <div className="text-2xl font-bold text-orange-600">{option.price}</div>
                  <div className="text-sm text-gray-600">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            * Billing starts after your 28-day trial period. You can change this anytime in your account.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-800 mb-2">Payment Summary</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>4 weeks storage rent</span>
              <span>$340.00</span>
            </div>
            <div className="flex justify-between">
              <span>Security bond (refundable)</span>
              <span>$300.00</span>
            </div>
            <div className="border-t border-gray-300 pt-1 flex justify-between font-semibold">
              <span>Total due today</span>
              <span>$640.00</span>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Future billing: {billingOptions.find(o => o.value === billingFrequency)?.price} {billingFrequency} (after 28-day trial)
            </div>
          </div>
        </div>

        <button
          onClick={createCheckoutSession}
          disabled={loading}
          className="w-full bg-orange-500 text-white font-semibold py-4 px-6 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Redirecting to checkout...' : 'Continue to Payment - $640'}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          You'll be redirected to Stripe's secure checkout page.
        </p>
      </div>
    </div>
  );
}

// Success Component
function PaymentSuccess() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <StoreLogo />
        
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
          <p className="text-gray-600">
            Welcome to StoreHere! You'll receive a confirmation email shortly with your container details.
          </p>
        </div>

        <button 
          onClick={() => window.location.href = '/client'}
          className="w-full bg-orange-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-orange-600 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

// Verification Component
function VerificationStep({ userEmail, onConfirm }) {
  const [confirmationCode, setConfirmationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await confirmSignUp({
        username: userEmail,
        confirmationCode
      });
      
      onConfirm();
    } catch (error) {
      console.error('Confirmation error:', error);
      setError(error.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <StoreLogo />
        
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Verify Your Account
            </h1>
            <p className="text-gray-600">
              Please enter the confirmation code sent to{' '}
              <span className="font-medium">{userEmail}</span>
            </p>
          </div>

          <form onSubmit={handleConfirmSignUp} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Enter confirmation code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Account'}
            </button>
          </form>

          <button 
            onClick={() => window.location.href = '/signup'}
            className="w-full text-gray-600 font-medium py-2 hover:text-gray-800 transition-colors"
          >
            Back to Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Payment Component
function Payment() {
  const [user, setUser] = useState(null);
  const [userAttributes, setUserAttributes] = useState({});
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('verify'); // 'verify', 'checking', 'waiting', 'payment', 'success'
  const [availableContainer, setAvailableContainer] = useState(null);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    checkUserStatus();
  }, []);

  useEffect(() => {
    if (step === 'checking') {
      loadAvailableContainers();
    }
  }, [step]);

  const checkUserStatus = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    
    // Handle Stripe checkout results
    if (success === 'true') {
      setStep('success');
      setLoading(false);
      return;
    }
    
    if (canceled === 'true') {
      setPaymentError('Payment was canceled. Please try again.');
      setStep('payment');
      setLoading(false);
      return;
    }
    
    if (username) {
      setUserEmail(username);
      setStep('verify');
      setLoading(false);
      return;
    }
    
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser(currentUser);
      setUserAttributes(attributes);
      setUserEmail(attributes.email);
      setStep('checking');
    } catch (error) {
      window.location.href = '/signup';
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableContainers = async () => {
    try {
      const sites = await getSites();
      let availableContainer = null;
      
      for (const site of sites) {
        const containers = await getContainers(site.id);
        
        const available = containers.find(container => {
          if (container.type !== 'container') return false;
          
          let status = container.status;
          
          if (container.subscriptionStatus === 'active' && container.securityBondStatus === 'paid') {
            status = 'rented-paid';
          } else if (container.subscriptionStatus === 'past_due' || container.overdueSince) {
            status = 'rented-unpaid';
          } else if (container.subscriptionStatus === 'canceled' || container.subscriptionStatus === 'inactive') {
            status = 'available';
          }
          
          return status === 'available';
        });
        
        if (available) {
          availableContainer = { ...available, siteId: site.id, siteName: site.name };
          break;
        }
      }
      
      if (availableContainer) {
        setAvailableContainer(availableContainer);
        setStep('payment');
      } else {
        setStep('waiting');
      }
    } catch (error) {
      console.error('Error loading containers:', error);
      setStep('waiting');
    }
  };

  const handleVerificationSuccess = () => {
    setStep('checking');
    checkUserStatus();
  };

  const handlePaymentSuccess = (paymentIntent) => {
    console.log('Payment successful:', paymentIntent);
    setStep('success');
  };

  const handlePaymentError = (error) => {
    console.error('Payment error:', error);
    setPaymentError(error);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return <VerificationStep userEmail={userEmail} onConfirm={handleVerificationSuccess} />;
  }

  if (step === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking container availability...</p>
        </div>
      </div>
    );
  }

  if (step === 'waiting') {
    return <WaitingList />;
  }

  if (step === 'success') {
    return <PaymentSuccess />;
  }

  if (step === 'payment' && availableContainer) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <StoreLogo />
          
          {paymentError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {paymentError}
            </div>
          )}

          <PaymentForm
            container={availableContainer}
            userAttributes={userAttributes}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Something went wrong. Redirecting...</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="text-orange-600 hover:underline"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}

export default Payment;