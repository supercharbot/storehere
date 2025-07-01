import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser, signOut, fetchUserAttributes } from 'aws-amplify/auth';
import './aws-config'; // Import to configure Amplify
import MainLayout from './components/MainLayout';
import Login from './components/Login';
import HomePage from './components/HomePage';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import Payment from './components/Payment';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      console.log('Checking auth state...');
      const currentUser = await getCurrentUser();
      const userAttributes = await fetchUserAttributes();
      console.log('User found:', currentUser);
      console.log('User attributes:', userAttributes);
      
      // Combine user info with attributes for easy access
      const userWithAttributes = {
        ...currentUser,
        attributes: userAttributes
      };
      
      setUser(userWithAttributes);
    } catch (error) {
      console.log('No authenticated user:', error.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (user) => {
    try {
      // Fetch user attributes after sign in
      const userAttributes = await fetchUserAttributes();
      const userWithAttributes = {
        ...user,
        attributes: userAttributes
      };
      setUser(userWithAttributes);
    } catch (error) {
      console.error('Error fetching user attributes:', error);
      setUser(user); // Fallback to user without attributes
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/home" element={<HomePage />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        
        {/* Admin login route */}
        <Route path="/admin/login" element={
          user ? <Navigate to="/system" replace /> : <Login onSignIn={handleSignIn} />
        } />
        
        {/* Protected admin routes */}
        <Route path="/system/*" element={
          user ? (
            <MainLayout user={user} onSignOut={handleSignOut} />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        } />
      </Routes>
    </Router>
  );
}

export default App;