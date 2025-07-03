import React from 'react';
import { Lock, Clock, MapPin, Shield, Container, Check } from 'lucide-react';

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

function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <StoreLogo />
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-600 hover:text-orange-500 transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-orange-500 transition-colors">Pricing</a>
              <a href="#location" className="text-gray-600 hover:text-orange-500 transition-colors">Location</a>
              <a href="#contact" className="text-gray-600 hover:text-orange-500 transition-colors">Contact</a>
            </nav>
            <div className="flex space-x-4">
              <button 
                onClick={() => window.location.href = '/signin'}
                className="text-gray-600 hover:text-orange-500 transition-colors font-medium"
              >
                Sign In
              </button>
              <button 
                onClick={() => window.location.href = '/signup'}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold mb-4">
                SECURE SELF
                <span className="text-orange-500"> STORAGE</span>
              </h1>
              <h2 className="text-2xl font-semibold mb-6 text-gray-300">
                24/7 ACCESS
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                Short or long term storage solutions for commercial or residential storage
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors">
                  View Available Units
                </button>
                <button className="border-2 border-white text-white hover:bg-white hover:text-gray-800 px-8 py-3 rounded-lg font-semibold text-lg transition-colors">
                  Get Quote
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gray-700 rounded-lg p-8 border-l-4 border-orange-500">
                <div className="text-center">
                  <div className="text-orange-500 text-4xl font-bold mb-2">$80</div>
                  <div className="text-gray-300 text-lg mb-4">per week (inc GST)</div>
                  <div className="border-t border-gray-600 pt-4">
                    <h3 className="font-semibold mb-3">20 foot shipping containers</h3>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>2.6m (H) × 2.4m (W) × 6.0m (L)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">STORAGE MADE EASY</h2>
            <p className="text-xl text-gray-600">Everything you need for secure, convenient storage</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center bg-white p-6 rounded-lg shadow-sm">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Unrestricted Access</h3>
              <p className="text-gray-600">365 days - 24/7</p>
            </div>
            
            <div className="text-center bg-white p-6 rounded-lg shadow-sm">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">No Lock-in Contract</h3>
              <p className="text-gray-600">Weekly Rates</p>
            </div>
            
            <div className="text-center bg-white p-6 rounded-lg shadow-sm">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Gated Facilities</h3>
              <p className="text-gray-600">Security cameras and flood lighting</p>
            </div>
            
            <div className="text-center bg-white p-6 rounded-lg shadow-sm">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Container className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Premium Containers</h3>
              <p className="text-gray-600">Clean, dry, and secure storage units</p>
            </div>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section id="location" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">CONVENIENT LOCATION</h2>
              <div className="flex items-start gap-4 mb-6">
                <MapPin className="w-6 h-6 text-orange-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Right behind Bunnings Edwardstown!</h3>
                  <p className="text-gray-600">Easy access location with plenty of parking and wide driveways for moving trucks.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-700">Easy truck and trailer access</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-700">Ample parking for customers</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-700">Close to major transport routes</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-2" />
                <p>Interactive Map</p>
                <p className="text-sm">Coming Soon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Store with Us?</h2>
          <p className="text-xl text-gray-300 mb-8">Get started today with our simple booking process</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors">
              Book Now
            </button>
            <button className="border-2 border-white text-white hover:bg-white hover:text-gray-800 px-8 py-3 rounded-lg font-semibold text-lg transition-colors">
              Contact Us
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <StoreLogo />
              <p className="text-gray-400 mt-4 max-w-md">
                Secure, convenient self-storage solutions for all your residential and commercial needs.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-orange-500 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-orange-500 transition-colors">Storage Units</a></li>
                <li><a href="#" className="hover:text-orange-500 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-orange-500 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contact Info</h3>
              <ul className="space-y-2 text-gray-400">
                <li>📞 (08) 1234 5678</li>
                <li>✉️ info@storehere.com.au</li>
                <li>📍 Edwardstown, SA</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 StoreHere Self Storage. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;