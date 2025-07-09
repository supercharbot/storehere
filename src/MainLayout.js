import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Container, Users, User } from 'lucide-react';
import Clients from './Clients';
import Containers from './Containers';
import Profile from './Profile';

// Page Components - Container management now uses dedicated component

function ClientsPage() {
  return <Clients />;
}

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

// Main Layout Component
function MainLayout({ user, onSignOut }) {
  const location = useLocation();
  const [userAttributes, setUserAttributes] = useState(null);

  // Fetch user attributes on component mount
  React.useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { fetchUserAttributes } = await import('aws-amplify/auth');
        const attributes = await fetchUserAttributes();
        setUserAttributes(attributes);
      } catch (error) {
        console.error('Error fetching user attributes:', error);
      }
    };

    if (user) {
      fetchUserData();
    }
  }, [user]);

  const displayName = userAttributes?.given_name || user?.username || 'User';
  
  const navigation = [
    { name: 'Container', href: '/admin', icon: Container },
    { name: 'Clients', href: '/admin/clients', icon: Users },
    { name: 'Profile', href: '/admin/profile', icon: User },
  ];

  const isActive = (href) => {
    if (href === '/admin') return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <StoreLogo />
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Welcome, {displayName}
              </div>
              <button
                onClick={onSignOut}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded border border-gray-300 hover:border-gray-400"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-gray-800 min-h-screen">
          <div className="p-6">
            <div className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Icon size={20} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Containers />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;