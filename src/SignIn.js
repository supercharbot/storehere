import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, confirmSignIn } from 'aws-amplify/auth';
import { ArrowLeft } from 'lucide-react';

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

function SignIn({ onSignIn }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [missingAttributes, setMissingAttributes] = useState([]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await signIn({ username: email, password });
      
      if (user.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setNeedsPasswordChange(true);
        setMissingAttributes(user.nextStep.missingAttributes || []);
        console.log('Missing attributes:', user.nextStep.missingAttributes);
        setLoading(false);
        return;
      }
      
      console.log('Sign in successful:', user);
      
      if (onSignIn) {
        onSignIn(user);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // Step 1: Complete password challenge with attributes in challengeResponse
      const user = await confirmSignIn({
        challengeResponse: newPassword,
        options: {
          userAttributes: {
            given_name: firstName.trim(),
            family_name: lastName.trim()
          }
        }
      });
      
      console.log('Password change successful:', user);
      
      if (onSignIn) {
        onSignIn(user);
      }
    } catch (error) {
      console.error('Password change error:', error);
      // Try alternative format if first fails
      try {
        console.log('Trying alternative format...');
        const user = await confirmSignIn({
          challengeResponse: newPassword,
          userAttributes: {
            given_name: firstName.trim(),
            family_name: lastName.trim()
          }
        });
        
        console.log('Alternative format successful:', user);
        if (onSignIn) {
          onSignIn(user);
        }
      } catch (altError) {
        console.error('Alternative format also failed:', altError);
        setError(altError.message || 'Password change failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Back to Home
          </button>

          <StoreLogo />
          
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
            {needsPasswordChange ? 'Set New Password' : 'Sign In to Your Account'}
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {needsPasswordChange ? (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 px-4 rounded-lg font-medium"
              >
                {loading ? 'Setting Password...' : 'Set Password'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 px-4 rounded-lg font-medium"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {!needsPasswordChange && (
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button 
                  onClick={() => navigate('/signup')}
                  className="text-orange-500 hover:text-orange-600 font-medium"
                >
                  Sign up here
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SignIn;