import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { getCurrentUser, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import SignIn from './SignIn';
import SignUp from './SignUp';
import Payment from './Payment';
import HomePage from './HomePage';
import MainLayout from './MainLayout';
import ClientManagement from './ClientManagement';
import Signature from './Signature';

// Protected Route Component
function ProtectedRoute({ children, isAuthenticated, requiredRole = null, userRole = null }) {
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }
  
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

// Auth Provider Component
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Navigate after sign-in based on user role
  useEffect(() => {
    if (shouldNavigate && user) {
      setShouldNavigate(false);
      if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/client');
      }
    }
  }, [user, isAdmin, shouldNavigate, navigate]);

  const checkAuthStatus = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        await handleUserAuthentication(currentUser);
      }
    } catch (error) {
      console.log('No authenticated user found');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAuthentication = async (authUser) => {
    try {
      setUser(authUser);
      
      // Get tokens directly
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      
      console.log('Auth session:', session);
      console.log('Access token payload:', session.tokens?.accessToken?.payload);
      console.log('ID token payload:', session.tokens?.idToken?.payload);
      
      // Check for groups in token payloads
      const accessTokenGroups = session.tokens?.accessToken?.payload?.['cognito:groups'];
      const idTokenGroups = session.tokens?.idToken?.payload?.['cognito:groups'];
      
      console.log('Access token groups:', accessTokenGroups);
      console.log('ID token groups:', idTokenGroups);
      
      const groups = accessTokenGroups || idTokenGroups;
      const userIsAdmin = groups && (
        (Array.isArray(groups) && groups.includes('Admins')) ||
        (typeof groups === 'string' && groups === 'Admins')
      );
      
      setIsAdmin(userIsAdmin);
      console.log('Final admin status:', userIsAdmin);
      
    } catch (error) {
      console.error('Error checking user groups:', error);
      setIsAdmin(false);
    }
  };

  const handleSignIn = async (authUser) => {
    // Check if user needs to set new password first
    if (authUser.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      console.log('User needs to set new password');
      return; // Let SignIn component handle this
    }
    
    // Get the full authenticated user with tokens
    try {
      const currentUser = await getCurrentUser();
      await handleUserAuthentication(currentUser);
      setShouldNavigate(true); // Trigger navigation after state is set
    } catch (error) {
      console.error('Error getting current user:', error);
      navigate('/');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setIsAdmin(false);
      navigate('/signin');
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/signin" 
        element={
          user ? (
            <Navigate to={isAdmin ? "/admin" : "/"} replace />
          ) : (
            <SignIn onSignIn={handleSignIn} />
          )
        } 
      />
      <Route 
        path="/signup" 
        element={
          user ? (
            <Navigate to={isAdmin ? "/admin" : "/"} replace />
          ) : (
            <SignUp />
          )
        } 
      />
      <Route 
        path="/payment" 
        element={<Payment user={user} />} 
      />
      <Route 
        path="/signature" 
        element={<Signature />} 
      />
      <Route 
        path="/" 
        element={
          user ? (
            isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/client" replace />
          ) : (
            <HomePage user={null} onSignOut={null} />
          )
        } 
      />
      <Route 
        path="/client" 
        element={
          <ProtectedRoute isAuthenticated={!!user} requiredRole="user" userRole={isAdmin ? 'admin' : 'user'}>
            <ClientManagement user={user} onSignOut={handleSignOut} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute isAuthenticated={!!user} requiredRole="admin" userRole={isAdmin ? 'admin' : 'user'}>
            <MainLayout user={user} onSignOut={handleSignOut} />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider />
    </Router>
  );
}

export default App;