import React, { useState } from 'react';
import { signUp, confirmSignUp } from 'aws-amplify/auth';
import { Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react';

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

function PasswordRequirements({ password, showRequirements }) {
  const requirements = [
    { text: 'At least 8 characters', test: (pwd) => pwd.length >= 8 },
    { text: 'One uppercase letter', test: (pwd) => /[A-Z]/.test(pwd) },
    { text: 'One lowercase letter', test: (pwd) => /[a-z]/.test(pwd) },
    { text: 'One number', test: (pwd) => /\d/.test(pwd) },
    { text: 'One special character', test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) }
  ];

  if (!showRequirements) return null;

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</div>
      <div className="space-y-1">
        {requirements.map((req, index) => {
          const isValid = req.test(password);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              {isValid ? (
                <Check size={16} className="text-green-600" />
              ) : (
                <X size={16} className="text-gray-400" />
              )}
              <span className={isValid ? 'text-green-600' : 'text-gray-600'}>
                {req.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SignUp({ onSignIn }) {
  const [step, setStep] = useState('signup'); // 'signup' or 'confirm'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');

  // Registration type
  const [registrationType, setRegistrationType] = useState('company'); // 'company' or 'personal'

  // Form data
  const [formData, setFormData] = useState({
    // Basic account info
    email: '',
    password: '',
    confirmPassword: '',
    
    // Personal details
    given_name: '',
    family_name: '',
    mobile_phone: '',
    title: '',
    
    // Company details (only for company registration)
    company_name: '',
    abn: '',
    
    // Contact details
    home_address: '',
    home_postcode: '',
    postal_address: '', // Optional
    postal_postcode: '', // Optional
    home_phone: '',
    work_phone: '',
    
    // Preferences
    marketing_consent: false,
    
    // ACP (Authorised Contact Person) details
    acp_title: '',
    acp_first_name: '',
    acp_surname: '',
    acp_address: '',
    acp_postcode: '',
    acp_home_phone: '',
    acp_mobile_phone: '',
    acp_email: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateForm = () => {
    // Basic required fields for all registration types
    const basicRequiredFields = [
      'email', 'password', 'given_name', 'family_name', 'mobile_phone', 
      'title', 'home_address', 'home_postcode', 'home_phone', 
      'acp_title', 'acp_first_name', 'acp_surname', 'acp_address', 
      'acp_postcode', 'acp_home_phone', 'acp_mobile_phone', 'acp_email'
    ];

    // Additional required fields for company registration
    const companyRequiredFields = ['company_name', 'abn', 'work_phone'];

    // Determine which fields to validate based on registration type
    const requiredFields = registrationType === 'company' 
      ? [...basicRequiredFields, ...companyRequiredFields]
      : basicRequiredFields;

    for (const field of requiredFields) {
      if (!formData[field]?.trim()) {
        const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        setError(`${fieldName} is required`);
        return false;
      }
    }

    // Password validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!emailRegex.test(formData.acp_email)) {
      setError('Please enter a valid ACP email address');
      return false;
    }

    // Phone number validation (basic)
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    const phonesToValidate = [formData.mobile_phone, formData.home_phone, formData.acp_home_phone, formData.acp_mobile_phone];
    
    // Add work phone validation only for company registration
    if (registrationType === 'company') {
      phonesToValidate.push(formData.work_phone);
    }

    for (const phone of phonesToValidate) {
      if (phone && !phoneRegex.test(phone)) {
        setError('Please enter valid phone numbers');
        return false;
      }
    }

    return true;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      // Prepare user attributes for Cognito
      const userAttributes = {
        // Standard Cognito attributes
        email: formData.email,
        given_name: formData.given_name,
        family_name: formData.family_name,
        phone_number: formData.mobile_phone.startsWith('+') ? formData.mobile_phone : `+61${formData.mobile_phone.replace(/^0/, '')}`,
        
        // Custom attributes
        'custom:title': formData.title,
        'custom:home_address': formData.home_address,
        'custom:home_postcode': formData.home_postcode,
        'custom:postal_address': formData.postal_address,
        'custom:postal_postcode': formData.postal_postcode,
        'custom:home_phone': formData.home_phone,
        'custom:marketing_consent': formData.marketing_consent.toString(),
        'custom:acp_title': formData.acp_title, 
        'custom:acp_first_name': formData.acp_first_name,
        'custom:acp_surname': formData.acp_surname,
        'custom:acp_address': formData.acp_address,
        'custom:acp_postcode': formData.acp_postcode,
        'custom:acp_home_phone': formData.acp_home_phone,
        'custom:acp_mobile_phone': formData.acp_mobile_phone,
        'custom:acp_email': formData.acp_email
      };

      // Add company-specific attributes only for company registration
      if (registrationType === 'company') {
        userAttributes['custom:company_name'] = formData.company_name;
        userAttributes['custom:abn'] = formData.abn;
        userAttributes['custom:work_phone'] = formData.work_phone;
      }

      const result = await signUp({
        username: formData.email,
        password: formData.password,
        options: {
            userAttributes: userAttributes
        }
      });

      console.log('Sign up successful:', result);
      setStep('confirm');
    } catch (error) {
      console.error('Sign up error:', error);
      setError(error.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    
    if (!confirmationCode.trim()) {
      setError('Please enter the confirmation code');
      return;
    }

    setLoading(true);
    setError('');

    try {
        await confirmSignUp({
            username: formData.email,
            confirmationCode: confirmationCode
        });

        // Sign in the user after confirmation
        const { signIn } = await import('aws-amplify/auth');
        await signIn({ 
          username: formData.email, 
          password: formData.password 
        });

        // Redirect to payment page after successful confirmation
        window.location.href = '/payment';
    } catch (error) {
        console.error('Confirmation error:', error);
        setError(error.message || 'Confirmation failed');
    } finally {
        setLoading(false);
    }
  };

  const resendConfirmationCode = async () => {
    try {
      const { resendSignUpCode } = await import('aws-amplify/auth');
      await resendSignUpCode({ username: formData.email });
      setError('');
      alert('Confirmation code sent successfully!');
    } catch (error) {
      setError('Failed to resend confirmation code');
    }
  };

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <StoreLogo />
            
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
              Confirm Your Account
            </h2>

            <p className="text-sm text-gray-600 mb-6 text-center">
              We've sent a confirmation code to <strong>{formData.email}</strong>. 
              Please enter the code below to activate your account.
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
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 px-4 rounded-lg font-medium"
              >
                {loading ? 'Confirming...' : 'Confirm Account'}
              </button>
            </form>

            <div className="text-center mt-4">
              <button
                onClick={resendConfirmationCode}
                className="text-sm text-orange-600 hover:text-orange-700"
              >
                Resend confirmation code
              </button>
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => setStep('signup')}
                className="text-sm text-gray-600 hover:text-gray-700 flex items-center gap-1 mx-auto"
              >
                <ArrowLeft size={16} />
                Back to registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <StoreLogo />
          
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
            Create Your StoreHere Account
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-8">
            {/* Registration Type Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                Registration Type
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    registrationType === 'company' 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => setRegistrationType('company')}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="company"
                      name="registrationType"
                      value="company"
                      checked={registrationType === 'company'}
                      onChange={() => setRegistrationType('company')}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                    />
                    <div>
                      <label htmlFor="company" className="font-medium text-gray-900 cursor-pointer">
                        Company Registration
                      </label>
                      <p className="text-sm text-gray-600">
                        Register for your business with company details and ABN
                      </p>
                    </div>
                  </div>
                </div>

                <div 
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    registrationType === 'personal' 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => setRegistrationType('personal')}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="personal"
                      name="registrationType"
                      value="personal"
                      checked={registrationType === 'personal'}
                      onChange={() => setRegistrationType('personal')}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                    />
                    <div>
                      <label htmlFor="personal" className="font-medium text-gray-900 cursor-pointer">
                        Personal Registration
                      </label>
                      <p className="text-sm text-gray-600">
                        Register as an individual for personal storage needs
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                Account Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      onFocus={() => setShowPasswordRequirements(true)}
                      onBlur={() => setShowPasswordRequirements(false)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <PasswordRequirements 
                    password={formData.password} 
                    showRequirements={showPasswordRequirements}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                Personal Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    <option value="">Select Title</option>
                    <option value="Mr">Mr</option>
                    <option value="Ms">Ms</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Dr">Dr</option>
                    <option value="Prof">Prof</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.given_name}
                    onChange={(e) => handleInputChange('given_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.family_name}
                    onChange={(e) => handleInputChange('family_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Company Information - Only show for company registration */}
            {registrationType === 'company' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                  Company Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required={registrationType === 'company'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ABN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.abn}
                      onChange={(e) => handleInputChange('abn', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="11 digits"
                      required={registrationType === 'company'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                Contact Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.home_address}
                    onChange={(e) => handleInputChange('home_address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Postcode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.home_postcode}
                    onChange={(e) => handleInputChange('home_postcode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Address <span className="text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.postal_address}
                    onChange={(e) => handleInputChange('postal_address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="If different from home address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Postcode <span className="text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.postal_postcode}
                    onChange={(e) => handleInputChange('postal_postcode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className={`grid grid-cols-1 gap-4 ${registrationType === 'company' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile_phone}
                    onChange={(e) => handleInputChange('mobile_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="04XX XXX XXX"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.home_phone}
                    onChange={(e) => handleInputChange('home_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                {registrationType === 'company' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Work Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.work_phone}
                      onChange={(e) => handleInputChange('work_phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required={registrationType === 'company'}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Authorised Contact Person */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                Authorised Contact Person (ACP)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ACP Title <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.acp_title}
                    onChange={(e) => handleInputChange('acp_title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    <option value="">Select Title</option>
                    <option value="Mr">Mr</option>
                    <option value="Ms">Ms</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Dr">Dr</option>
                    <option value="Prof">Prof</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ACP First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.acp_first_name}
                    onChange={(e) => handleInputChange('acp_first_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ACP Surname <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.acp_surname}
                    onChange={(e) => handleInputChange('acp_surname', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ACP Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.acp_address}
                    onChange={(e) => handleInputChange('acp_address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ACP Postcode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.acp_postcode}
                    onChange={(e) => handleInputChange('acp_postcode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ACP Home Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.acp_home_phone}
                    onChange={(e) => handleInputChange('acp_home_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ACP Mobile Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.acp_mobile_phone}
                    onChange={(e) => handleInputChange('acp_mobile_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="04XX XXX XXX"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ACP Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.acp_email}
                    onChange={(e) => handleInputChange('acp_email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Marketing Consent */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                Preferences
              </h3>
              
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="marketing_consent"
                  checked={formData.marketing_consent}
                  onChange={(e) => handleInputChange('marketing_consent', e.target.checked)}
                  className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label htmlFor="marketing_consent" className="text-sm text-gray-700">
                  I consent to receiving marketing communications from StoreHere including 
                  promotions, updates, and relevant storage offers via email and SMS.
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => window.location.href = '/signin'}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-3 px-6 rounded-lg font-medium"
              >
                Back to Sign In
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-3 px-6 rounded-lg font-medium"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>

          <div className="text-center mt-6 text-sm text-gray-600">
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp;