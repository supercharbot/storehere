import React, { useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes, confirmSignUp } from 'aws-amplify/auth';
import { ArrowLeft, Package, Clock, ExternalLink } from 'lucide-react';
import { getContainers, getSites } from './dynamodb';

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
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <StoreLogo />
        
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              All Containers Currently Rented
            </h1>
            <p className="text-gray-600">
              We're sorry, but all our storage containers are currently occupied. 
              We'll notify you as soon as one becomes available.
            </p>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-700 space-y-1 text-left">
              <li>• You'll be added to our priority waiting list</li>
              <li>• We'll email you when a container becomes available</li>
              <li>• You'll have 24 hours to secure your container</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <button className="w-full bg-orange-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors">
              Join Waiting List
            </button>
            
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full text-gray-600 font-medium py-2 hover:text-gray-800 transition-colors"
            >
              Back to Home
            </button>
          </div>
          
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Need immediate storage? Contact us at{' '}
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

// Available Container Component - REMOVED since we redirect directly to Stripe

// Verification Component (for unconfirmed users)
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
  const [step, setStep] = useState('verify'); // 'verify', 'checking', 'waiting', or 'available'
  const [availableContainer, setAvailableContainer] = useState(null);

  useEffect(() => {
    checkUserStatus();
  }, []);

  useEffect(() => {
    if (step === 'checking') {
      loadAvailableContainers();
    }
  }, [step]);

  const loadAvailableContainers = async () => {
    try {
      // Get all sites
      const sites = await getSites();
      let availableContainer = null;
      
      // Check each site for available containers
      for (const site of sites) {
        const containers = await getContainers(site.id);
        
        // Use same logic as Containers.js to determine availability
        const available = containers.find(container => {
          if (container.type !== 'container') return false;
          
          // Auto-determine status based on payment data
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
        // Redirect directly to Stripe payment link
        redirectToStripePayment(availableContainer);
      } else {
        setStep('waiting');
      }
    } catch (error) {
      console.error('Error loading containers:', error);
      setStep('waiting'); // Default to waiting list on error
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
      setStep('checking');
    } catch (error) {
      window.location.href = '/signup';
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSuccess = () => {
    setStep('checking');
    checkUserStatus();
  };

  const redirectToStripePayment = (container) => {
    // Add container and user info to the Stripe payment link URL
    const stripeUrl = new URL('https://buy.stripe.com/test_dRm28qbGl4WXh0M1pV8Zq02');
    
    // Add metadata as URL parameters (Stripe will receive these)
    stripeUrl.searchParams.append('client_reference_id', userAttributes.sub);
    stripeUrl.searchParams.append('prefilled_email', userAttributes.email);
    
    // You can also add custom fields if configured in Stripe
    const metadata = {
      container_number: container.number,
      site_id: container.siteId,
      user_email: userAttributes.email,
      user_name: `${userAttributes.given_name} ${userAttributes.family_name}`
    };
    
    // Add metadata to URL for tracking
    Object.entries(metadata).forEach(([key, value]) => {
      stripeUrl.searchParams.append(key, value);
    });
    
    // Redirect to Stripe payment link
    window.location.href = stripeUrl.toString();
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

  // If we reach here, something went wrong - redirect to home
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