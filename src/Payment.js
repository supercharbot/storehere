import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getCurrentUser, fetchUserAttributes, confirmSignUp } from 'aws-amplify/auth';
import { ArrowLeft, CreditCard, Shield, Check, Package, Calendar } from 'lucide-react';
import { getContainers, getSites } from './dynamodb';

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

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

// Card input styling
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
  hidePostalCode: true,
};

function PaymentForm({ availableContainer, userAttributes, selectedMonths, onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const weeklyRate = 80;
  const securityDeposit = 300;
  const weeksToPayFor = selectedMonths * 4; // 4 weeks per month
  const totalWeeklyPayments = weeksToPayFor * weeklyRate;
  const totalAmount = totalWeeklyPayments + securityDeposit;
  
  const handlePayment = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements || !availableContainer) return;

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent for security bond + prepaid weeks
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount * 100, // Convert to cents
          currency: 'aud',
          metadata: {
            containerNumber: availableContainer.number,
            siteId: availableContainer.siteId,
            userId: userAttributes.sub,
            userEmail: userAttributes.email,
            monthsPaid: selectedMonths,
            weeksPaid: weeksToPayFor
          }
        })
      });

      const { clientSecret } = await response.json();

      // Confirm payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: `${userAttributes.given_name} ${userAttributes.family_name}`,
            email: userAttributes.email,
            address: {
              postal_code: userAttributes.postal_postcode || userAttributes['custom:postal_postcode'] || '12345',
            },
          },
        }
      });

      if (stripeError) {
        setError(stripeError.message);
      } else if (paymentIntent.status === 'succeeded') {
        // Lambda will automatically create the subscription
        onPaymentSuccess();
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handlePayment} className="space-y-6">
      {/* Container Info */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center gap-3 mb-3">
          <Package className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-800">Your Container</h3>
        </div>
        <div className="text-sm text-blue-700">
          <p><strong>Container:</strong> {availableContainer.number}</p>
          <p><strong>Type:</strong> 20ft Standard Container</p>
          <p><strong>Dimensions:</strong> 2.6m(H) × 2.4m(W) × 6.0m(L)</p>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Payment Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Weekly Rate:</span>
            <span>${weeklyRate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Months Selected:</span>
            <span>{selectedMonths} month{selectedMonths > 1 ? 's' : ''}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Weeks to Pay ({weeksToPayFor} weeks):</span>
            <span>${totalWeeklyPayments}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Security Deposit:</span>
            <span>${securityDeposit}</span>
          </div>
          <hr className="border-gray-300" />
          <div className="flex justify-between font-semibold text-lg">
            <span>Total Due Today:</span>
            <span>${totalAmount}</span>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            This covers {selectedMonths} month{selectedMonths > 1 ? 's' : ''} of storage plus security deposit
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
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Details
              </label>
              <div className="border border-gray-300 rounded-lg p-3">
                <CardElement options={cardElementOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Security Notice */}
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <Shield className="w-5 h-5" />
        <span>Your payment is secured with 256-bit SSL encryption</span>
      </div>

      {/* Payment Button */}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-3 px-4 rounded-lg font-semibold text-lg"
      >
        {processing ? 'Processing...' : `Complete Payment ($${totalAmount})`}
      </button>

      {/* Terms */}
      <p className="text-xs text-gray-500 text-center">
        By completing this payment, you agree to our storage terms and conditions.
        Payment covers {selectedMonths} month{selectedMonths > 1 ? 's' : ''} of storage plus security deposit.
      </p>
    </form>
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
  const [availableContainer, setAvailableContainer] = useState(null);
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [loadingContainers, setLoadingContainers] = useState(false);

  useEffect(() => {
    checkUserStatus();
  }, []);

  useEffect(() => {
    if (step === 'payment') {
      loadAvailableContainers();
    }
  }, [step]);

  const loadAvailableContainers = async () => {
    setLoadingContainers(true);
    try {
      // First get all sites
      const sites = await getSites();
      let availableContainer = null;
      
      // Check each site for available containers
      for (const site of sites) {
        const containers = await getContainers(site.id);
        
        // Use same logic as Containers.js to determine availability
        const available = containers.find(container => {
          if (container.type !== 'container') return false;
          
          // Auto-determine status based on payment data (same logic as Containers.js)
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
      
      setAvailableContainer(availableContainer);
      
      if (!availableContainer) {
        setError('No containers currently available. Please contact us.');
      }
    } catch (error) {
      console.error('Error loading containers:', error);
      setError('Error loading available containers. Please try again.');
    } finally {
      setLoadingContainers(false);
    }
  };

  const checkUserStatus = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    
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
      setStep('payment');
    } catch (error) {
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
      
      window.location.href = '/';
    } catch (error) {
      console.error('Confirmation error:', error);
      setError(error.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    alert(`Payment successful! You have secured container ${availableContainer.number} for ${selectedMonths} month${selectedMonths > 1 ? 's' : ''}. Welcome to StoreHere!`);
    window.location.href = '/dashboard';
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
            <StoreLogo />
            
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
              Verify Your Email
            </h2>
            
            <p className="text-gray-600 text-center mb-6">
              We've sent a verification code to <strong>{userEmail}</strong>
            </p>
            
            <form onSubmit={handleConfirmSignUp}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 px-4 rounded-lg font-semibold"
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
    <Elements stripe={stripePromise}>
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
          {loadingContainers ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-600">Finding available containers...</div>
            </div>
          ) : !availableContainer ? (
            <div className="text-center py-12">
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                <p className="font-semibold">No Available Containers</p>
                <p className="text-sm mt-1">
                  All containers are currently rented. Please contact us to join the waiting list.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Month Selection */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Choose Payment Duration</h2>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <span className="font-medium text-gray-700">How many months would you like to pay for?</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4, 6, 12].map((months) => (
                      <button
                        key={months}
                        onClick={() => setSelectedMonths(months)}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          selectedMonths === months
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className="font-semibold">{months} Month{months > 1 ? 's' : ''}</div>
                        <div className="text-sm text-gray-600">
                          ${(months * 4 * 80) + 300} total
                        </div>
                        {months === 6 && (
                          <div className="text-xs text-green-600 font-medium">Popular</div>
                        )}
                        {months === 12 && (
                          <div className="text-xs text-orange-600 font-medium">Best Value</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Pricing Breakdown</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>• Weekly rate: $80</p>
                    <p>• Security deposit: $300 (refundable)</p>
                    <p>• Total weeks: {selectedMonths * 4}</p>
                    <p className="font-semibold text-gray-800 mt-2">
                      Total: ${(selectedMonths * 4 * 80) + 300}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Form */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Complete Payment</h2>
                
                {error && (
                  <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <PaymentForm
                  availableContainer={availableContainer}
                  userAttributes={userAttributes}
                  selectedMonths={selectedMonths}
                  onPaymentSuccess={handlePaymentSuccess}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Elements>
  );
}

export default Payment;