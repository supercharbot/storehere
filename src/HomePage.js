import React, { useState, useEffect } from 'react';
import { Lock, Clock, MapPin, Shield, Container, Check, Users, Package, ArrowRight, Star, Phone, Mail } from 'lucide-react';
import { getSites, getContainers } from './dynamodb';

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

// Interactive Map Component - Simplified without Google Maps
function LocationInfo() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-6">
        <MapPin className="w-16 h-16 text-orange-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Edwardstown Location</h3>
        <p className="text-gray-600">Conveniently located in southern Adelaide</p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <MapPin className="w-5 h-5 text-orange-500" />
          <span className="text-gray-700">Edwardstown, South Australia</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <Clock className="w-5 h-5 text-orange-500" />
          <span className="text-gray-700">24/7 Access Available</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <Shield className="w-5 h-5 text-orange-500" />
          <span className="text-gray-700">Secure & Well-Lit Area</span>
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          Exact address provided upon booking confirmation
        </p>
      </div>
    </div>
  );
}

// Availability Checker Component
function AvailabilityChecker() {
  const [loading, setLoading] = useState(true);
  const [availableContainers, setAvailableContainers] = useState(0);
  const [totalContainers, setTotalContainers] = useState(0);
  const [hasAvailability, setHasAvailability] = useState(false);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      setLoading(true);
      
      // Get all sites
      const sites = await getSites();
      let totalAvailable = 0;
      let totalCount = 0;
      
      // Check each site for available containers
      for (const site of sites) {
        const containers = await getContainers(site.id);
        
        const containerItems = containers.filter(item => item.type === 'container');
        totalCount += containerItems.length;
        
        // Count available containers using same logic as Containers.js
        const available = containerItems.filter(container => {
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
        
        totalAvailable += available.length;
      }
      
      setAvailableContainers(totalAvailable);
      setTotalContainers(totalCount);
      setHasAvailability(totalAvailable > 0);
      
    } catch (error) {
      console.error('Error checking availability:', error);
      // Default to showing signup option if there's an error
      setHasAvailability(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGetStorage = () => {
    if (hasAvailability) {
      window.location.href = '/signup';
    } else {
      // Redirect to waiting list signup
      window.location.href = '/signup?waitlist=true';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-orange-100">
      <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
        hasAvailability ? 'bg-green-100' : 'bg-orange-100'
      }`}>
        {hasAvailability ? (
          <Check className="w-8 h-8 text-green-600" />
        ) : (
          <Clock className="w-8 h-8 text-orange-600" />
        )}
      </div>
      
      <div className="space-y-4">
        {hasAvailability ? (
          <>
            <h3 className="text-2xl font-bold text-gray-800">Storage Available!</h3>
            <p className="text-gray-600 text-lg">
              Great news! We have <span className="font-semibold text-orange-600">
                {availableContainers} container{availableContainers !== 1 ? 's' : ''}
              </span> available right now.
            </p>
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <p className="text-green-800 text-sm">
                ✓ Immediate availability • ✓ Secure location • ✓ Competitive pricing
              </p>
            </div>
            <button
              onClick={handleGetStorage}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center gap-2 mx-auto"
            >
              Get Your Storage Unit
              <ArrowRight size={20} />
            </button>
          </>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-gray-800">Join Our Waiting List</h3>
            <p className="text-gray-600 text-lg">
              All {totalContainers} containers are currently occupied, but we'll notify you as soon as one becomes available.
            </p>
            <div className="bg-orange-50 rounded-lg p-4 mb-6">
              <p className="text-orange-800 text-sm">
                ✓ Priority notification • ✓ No commitment • ✓ Free to join
              </p>
            </div>
            <button
              onClick={handleGetStorage}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center gap-2 mx-auto"
            >
              Join Waiting List
              <Users size={20} />
            </button>
          </>
        )}
        
        <p className="text-sm text-gray-500 mt-4">
          {totalContainers} total storage units • Updated in real-time
        </p>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
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
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-50 to-orange-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold text-gray-800 mb-6">
                Secure Self Storage in 
                <span className="text-orange-500"> Edwardstown</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Safe, convenient, and affordable storage solutions for your home or business. 
                Access your belongings 24/7 with our secure keypad entry system.
              </p>
              
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <Shield className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">24/7 Security</p>
                </div>
                <div className="text-center">
                  <Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">24/7 Access</p>
                </div>
                <div className="text-center">
                  <Container className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Various Sizes</p>
                </div>
              </div>
            </div>
            
            <div>
              <AvailabilityChecker />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Why Choose StoreHere?</h2>
            <p className="text-xl text-gray-600">Everything you need for worry-free storage</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <Shield className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Maximum Security</h3>
              <p className="text-gray-600">CCTV monitoring, secure keypad entry, and individual unit locks ensure your belongings are always safe.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <Clock className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">24/7 Access</h3>
              <p className="text-gray-600">Access your storage unit anytime, day or night. Your schedule, your convenience.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <Package className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Flexible Sizes</h3>
              <p className="text-gray-600">From small personal items to large household goods, we have the perfect size for your needs.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <MapPin className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Prime Location</h3>
              <p className="text-gray-600">Conveniently located in Edwardstown with easy access to major roads and public transport.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <Check className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Hidden Fees</h3>
              <p className="text-gray-600">Transparent pricing with no surprise charges. What you see is what you pay.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <Users className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Customer Support</h3>
              <p className="text-gray-600">Friendly local team ready to help you with all your storage needs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600">No hidden fees, no long-term contracts required</p>
          </div>
          
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow-sm border-2 border-orange-200 p-8">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Storage Container</h3>
                <div className="text-4xl font-bold text-orange-500 mb-2">$80<span className="text-lg text-gray-600">/month</span></div>
                <p className="text-gray-600">Perfect for household items, furniture, and boxes</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Secure container storage</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">24/7 access with keypad entry</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">CCTV monitoring</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">No long-term contract required</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">$620 refundable security bond</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section id="location" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-800 mb-6">Convenient Edwardstown Location</h2>
              <p className="text-lg text-gray-600 mb-8">
                Our facility is strategically located in Edwardstown, providing easy access 
                for residents across southern Adelaide.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-700">Easy access from South Road</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-700">Close to public transport</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-700">Ample parking available</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-700">Safe, well-lit area</span>
                </div>
              </div>
            </div>
            
            <div>
              <LocationInfo />
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
            <button 
              onClick={() => window.location.href = '/signup'}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
            >
              Book Now
            </button>
            <button 
              onClick={() => window.location.href = '#contact'}
              className="border-2 border-white text-white hover:bg-white hover:text-gray-800 px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Get In Touch</h2>
            <p className="text-xl text-gray-600">Have questions? We're here to help!</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <Phone className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Call Us</h3>
              <p className="text-gray-600">Monday - Friday: 9am - 5pm</p>
              <a href="tel:+61812345678" className="text-orange-500 hover:text-orange-600 font-medium">
                (08) 1234 5678
              </a>
            </div>
            
            <div className="text-center">
              <Mail className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Email Us</h3>
              <p className="text-gray-600">We typically respond within 24 hours</p>
              <a href="mailto:info@storehere.com.au" className="text-orange-500 hover:text-orange-600 font-medium">
                info@storehere.com.au
              </a>
            </div>
            
            <div className="text-center">
              <MapPin className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Visit Us</h3>
              <p className="text-gray-600">Edwardstown, SA</p>
              <a href="#location" className="text-orange-500 hover:text-orange-600 font-medium">
                View on Map
              </a>
            </div>
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
                <li><a href="#features" className="hover:text-orange-500 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-orange-500 transition-colors">Pricing</a></li>
                <li><a href="#location" className="hover:text-orange-500 transition-colors">Location</a></li>
                <li><a href="#contact" className="hover:text-orange-500 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contact Info</h3>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center gap-2">
                  <Phone size={16} />
                  (08) 1234 5678
                </li>
                <li className="flex items-center gap-2">
                  <Mail size={16} />
                  info@storehere.com.au
                </li>
                <li className="flex items-center gap-2">
                  <MapPin size={16} />
                  Edwardstown, SA
                </li>
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