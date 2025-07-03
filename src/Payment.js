import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getCurrentUser, fetchUserAttributes, confirmSignUp } from 'aws-amplify/auth';
import { ArrowLeft, CreditCard, Shield, Check } from 'lucide-react';

// Initialize Stripe
const stripePromise = loadStripe('pk_test_51RauALCWFO1syG1hSp57tIMaDMjxylBP3pnYXXpEPcMdWUCH0YfBTnY1fqcX3o1IkydmtnRpiaxQnrehGpIF4QKQ00oPb0O9Pv');

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
  hidePostalCode: true, // Add this line
};

function PaymentForm({ selectedContainer, userAttributes, onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handlePayment = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements || !selectedContainer) return;

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent on your backend
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: (selectedContainer.price + 300) * 100, // Convert to cents
          currency: 'aud',
          metadata: {
            containerNumber: selectedContainer.id,
            siteId: 'default-site', // Replace with actual site ID
            userId: userAttributes.sub,
            userEmail: userAttributes.email,
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
              postal_code: '12345', // Add default postal code for testing
            },
          },
        }
      });

      if (stripeError) {
        setError(stripeError.message);
      } else if (paymentIntent.status === 'succeeded') {
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
        {processing ? 'Processing...' : `Complete Payment ($${selectedContainer.price + 300})`}
      </button>

      {/* Terms */}
      <p className="text-xs text-gray-500 text-center">
        By completing this payment, you agree to our storage terms and conditions.
        Your first payment covers the security deposit and first week of storage.
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
  const [selectedContainer, setSelectedContainer] = useState(null);

  // Container options
  const containers = [
    { id: 'A01', size: '20ft Standard', dimensions: '2.6m(H) × 2.4m(W) × 6.0m(L)', price: 80, available: true },
    { id: 'A02', size: '20ft Standard', dimensions: '2.6m(H) × 2.4m(W) × 6.0m(L)', price: 80, available: true },
    { id: 'A03', size: '20ft Standard', dimensions: '2.6m(H) × 2.4m(W) × 6.0m(L)', price: 80, available: false },
  ];

  useEffect(() => {
    checkUserStatus();
  }, []);

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

  const handleContainerSelect = (container) => {
    setSelectedContainer(container);
  };

  const handlePaymentSuccess = () => {
    alert('Payment successful! Welcome to StoreHere.');
    window.location.href = '/';
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
              We sent a confirmation code to {userEmail}
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
                <PaymentForm 
                  selectedContainer={selectedContainer}
                  userAttributes={userAttributes}
                  onPaymentSuccess={handlePaymentSuccess}
                />
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
    </Elements>
  );
}

export default Payment;