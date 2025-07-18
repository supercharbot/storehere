import React, { useState, useEffect } from 'react';
import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: process.env.REACT_APP_AWS_REGION,
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();
const TABLE_NAME = 'storage-management';
const WAITING_LIST_TABLE = 'waiting-list';
const ADMIN_EMAIL = 'char@devcluster257.digital'; // Change this to your admin email

// Container operations
const getContainers = async (siteId) => {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `SITE#${siteId}`,
      ':sk': 'CONTAINER#'
    }
  };
  
  try {
    const result = await dynamoDb.query(params).promise();
    return result.Items;
  } catch (error) {
    console.error('Error getting containers:', error);
    throw error;
  }
};

// Waiting list operations
const addToWaitingList = async (email) => {
  const item = {
    PK: 'WAITING_LIST',
    SK: `EMAIL#${email}`,
    email: email,
    joinedDate: new Date().toISOString(),
    status: 'active'
  };
  
  const params = {
    TableName: WAITING_LIST_TABLE,
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)' // Prevent duplicates
  };
  
  try {
    await dynamoDb.put(params).promise();
    return item;
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new Error('Email already exists in waiting list');
    }
    throw error;
  }
};

const getWaitingList = async () => {
  const params = {
    TableName: WAITING_LIST_TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'WAITING_LIST'
    }
  };
  
  try {
    const result = await dynamoDb.query(params).promise();
    return result.Items;
  } catch (error) {
    console.error('Error getting waiting list:', error);
    throw error;
  }
};

const sendAdminNotification = async (email) => {
  const params = {
    Source: ADMIN_EMAIL,
    Destination: {
      ToAddresses: [ADMIN_EMAIL]
    },
    Message: {
      Subject: {
        Data: 'New Waiting List Sign-up - StoreHere'
      },
      Body: {
        Text: {
          Data: `A new person has joined the waiting list:\n\nEmail: ${email}\nDate: ${new Date().toLocaleString()}\n\nPlease check the admin dashboard for more details.`
        }
      }
    }
  };
  
  try {
    await ses.sendEmail(params).promise();
  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw error;
  }
};

const notifyWaitingList = async () => {
  try {
    const waitingList = await getWaitingList();
    const activeEmails = waitingList.filter(item => item.status === 'active');
    
    for (const item of activeEmails) {
      const params = {
        Source: ADMIN_EMAIL,
        Destination: {
          ToAddresses: [item.email]
        },
        Message: {
          Subject: {
            Data: 'Container Available - StoreHere Storage'
          },
          Body: {
            Text: {
              Data: `Good news! A storage container is now available at StoreHere.\n\nVisit our website to reserve your container:\n${window.location.origin}/SignUp.js\n\nThis is a first-come, first-served basis, so act quickly!\n\nBest regards,\nStoreHere Team`
            }
          }
        }
      };
      
      await ses.sendEmail(params).promise();
    }
  } catch (error) {
    console.error('Error notifying waiting list:', error);
    throw error;
  }
};

const HomePage = () => {
  const [currentImage, setCurrentImage] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [containersAvailable, setContainersAvailable] = useState(false);
  const [loadingContainers, setLoadingContainers] = useState(true);
  const [waitingListEmail, setWaitingListEmail] = useState('');
  const [submitStatus, setSubmitStatus] = useState(''); // 'loading', 'success', 'error'
  
  const S3_BUCKET_URL = 'https://storehere-agreements.s3.amazonaws.com';
  
  const galleryImages = [
    `${S3_BUCKET_URL}/photos/Containers.jpg`,
    `${S3_BUCKET_URL}/photos/Container-Door.jpg`
  ];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % galleryImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [galleryImages.length]);

  useEffect(() => {
    setIsVisible(true);
    checkContainerAvailability();
  }, []);

  const checkContainerAvailability = async () => {
    try {
      // Using 'edwardstown' as the site ID based on the company location
      const containers = await getContainers('edwardstown');
      const availableContainers = containers.filter(container => container.status === 'available');
      setContainersAvailable(availableContainers.length > 0);
    } catch (error) {
      console.error('Error checking container availability:', error);
      setContainersAvailable(false);
    } finally {
      setLoadingContainers(false);
    }
  };

  const handleWaitingListSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('loading');
    
    try {
      // Add to waiting list
      await addToWaitingList(waitingListEmail);
      
      // Send admin notification
      await sendAdminNotification(waitingListEmail);
      
      setSubmitStatus('success');
      setWaitingListEmail('');
      
      // Reset success message after 5 seconds
      setTimeout(() => setSubmitStatus(''), 5000);
    } catch (error) {
      console.error('Error joining waiting list:', error);
      if (error.message === 'Email already exists in waiting list') {
        setSubmitStatus('duplicate');
      } else {
        setSubmitStatus('error');
      }
      
      // Reset error message after 5 seconds
      setTimeout(() => setSubmitStatus(''), 5000);
    }
  };

  const faqs = [
    {
      question: "Short Term Storage?",
      answer: "Stay as long or as short as you like! No lock-in contracts. Call 0408 805 996 to check availability."
    },
    {
      question: "How Much Does It Cost?",
      answer: "$85 per week (inc GST) plus $300 refundable security bond. Payment required before access."
    },
    {
      question: "Payment Options?",
      answer: "Direct Debit via GoCardless. Choose weekly or monthly payments - always paid in advance."
    },
    {
      question: "ID Requirements?",
      answer: "Photo ID required. Must sign terms and conditions. Credit check may apply."
    },
    {
      question: "Vehicle Storage?",
      answer: "No vehicle storage available."
    },
    {
      question: "Location?",
      answer: "Ivanhoe Ave Edwardstown - right behind Bunnings!"
    },
    {
      question: "Contents Insurance?",
      answer: "You're responsible for insuring your contents. We don't provide coverage."
    },
    {
      question: "Security Features?",
      answer: "Multiple security cameras, fully fenced and locked site, individual container locks."
    },
    {
      question: "Moving Equipment?",
      answer: "We don't supply trolleys, boxes, or moving equipment."
    },
    {
      question: "Shelving Allowed?",
      answer: "Free-standing shelving is fine. No permanent fixtures that damage containers."
    },
    {
      question: "Waterproof?",
      answer: "Yes, containers are fully waterproof."
    }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col touch-manipulation">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        
        /* Improve mobile touch targets */
        @media (max-width: 768px) {
          button, a, input[type="submit"] {
            min-height: 44px !important;
            min-width: 44px !important;
          }
          
          /* Ensure gallery navigation is touch-friendly */
          .gallery-nav button {
            min-height: 48px !important;
            min-width: 48px !important;
            padding: 12px 16px !important;
          }
          
          /* Larger touch targets for image dots */
          .image-dot {
            min-height: 44px !important;
            min-width: 44px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
        }
        
        /* Smooth scrolling for mobile */
        html {
          scroll-behavior: smooth;
        }
        
        /* Prevent zoom on iOS form inputs */
        @media screen and (max-width: 767px) {
          input[type="email"] {
            font-size: 16px !important;
          }
        }
        
        /* Better mobile header spacing */
        @media (max-width: 640px) {
          .mobile-header {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          
          .mobile-logo {
            max-width: 60% !important;
            height: auto !important;
          }
        }
      `}</style>
      {/* Header */}
      <header className="bg-white backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto mobile-header px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20 lg:h-24">
            <div className="flex items-center flex-1">
              <img 
                src={`${S3_BUCKET_URL}/photos/White Landscape Logo.jpg`} 
                alt="StoreHere Self Storage" 
                className="mobile-logo h-10 sm:h-16 lg:h-20 w-auto max-w-[60%]"
              />
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-6">
              <a 
                href="/signin" 
                className="text-gray-700 hover:text-orange-500 px-3 sm:px-4 lg:px-6 py-3 sm:py-3 text-sm sm:text-base lg:text-lg font-medium transition-all duration-300 hover:bg-gray-50 rounded-lg min-h-[48px] flex items-center justify-center"
              >
                Login
              </a>
              <a 
                href="/SignUp" 
                className="inline-block bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 sm:px-10 lg:px-12 py-3 sm:py-4 rounded-full text-lg sm:text-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 transition-opacity duration-1000">
            <img 
              src={galleryImages[currentImage]} 
              alt="Storage Containers" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60"></div>
          </div>
          
          <div className={`relative z-10 text-center px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
              STORAGE
            </h1>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold mb-6 sm:mb-8 text-orange-500">
              MADE EASY
            </h2>
            
            <div className="backdrop-blur-sm bg-white/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto mb-8 sm:mb-12 border border-white/30">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-orange-400 mb-2 sm:mb-4">$85</div>
              <div className="text-lg sm:text-xl text-white mb-4 sm:mb-6">per week (inc GST)</div>
              <div className="text-gray-200 space-y-1 sm:space-y-2 text-sm sm:text-base">
                <p>20ft Shipping Containers • 24/7 Access • No Lock-in Contract</p>
                <p>2.6m(H) × 2.4m(W) × 6.0m(L)</p>
              </div>
            </div>
            
            <div className="flex justify-center space-x-3 sm:space-x-4 mb-6 sm:mb-8">
              {galleryImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImage(index)}
                  className={`image-dot w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center ${
                    index === currentImage ? 'bg-orange-500/20 scale-110' : 'bg-white/40 hover:bg-white/60'
                  }`}
                >
                  <span 
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      index === currentImage ? 'bg-orange-500 scale-125' : 'bg-white/80'
                    }`}
                  ></span>
                </button>
              ))}
            </div>
            
            <a 
              href="/SignUp.js" 
              className="inline-block bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 sm:px-10 lg:px-12 py-3 sm:py-4 rounded-full text-lg sm:text-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105"
            >
              Get Started
            </a>
          </div>
        </section>

        {/* Gallery Section */}
        <section className="bg-gradient-to-br from-orange-50 via-white to-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-32">
            {/* Gallery Navigation */}
            <div className="flex justify-center mb-8 sm:mb-12 overflow-x-auto px-4">
              <div className="bg-white/80 backdrop-blur-sm p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-gray-200 shadow-lg">
                <div className="flex space-x-1 min-w-max">
                  {[
                    { id: 0, title: "Why Choose Us", shortTitle: "Why Us" },
                    { id: 1, title: "Get Started", shortTitle: "Start" },
                    { id: 2, title: "FAQ", shortTitle: "FAQ" },
                    { id: 3, title: "Contact", shortTitle: "Contact" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSection(tab.id)}
                      className={`gallery-nav whitespace-nowrap px-4 sm:px-4 lg:px-6 py-3 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base lg:text-lg font-semibold transition-all duration-300 min-h-[48px] flex items-center justify-center ${
                        activeSection === tab.id
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                          : 'text-gray-600 hover:text-orange-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="block sm:hidden">{tab.shortTitle}</span>
                      <span className="hidden sm:block">{tab.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gallery Content */}
            <div className="relative">
              {/* Why Choose Us */}
              {activeSection === 0 && (
                <div className="w-full animate-fadeIn">
                  <div className="text-center mb-8 sm:mb-12">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-600 to-gray-700 bg-clip-text text-transparent">
                      Why Choose Us?
                    </h2>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {[
                      {
                        title: "CONVENIENT LOCATION",
                        subtitle: "Right behind Bunnings Edwardstown"
                      },
                      {
                        title: "24/7 ACCESS",
                        subtitle: "Unrestricted access 365 days a year"
                      },
                      {
                        title: "SECURE FACILITY",
                        subtitle: "Gated with cameras and flood lighting"
                      }
                    ].map((feature, index) => (
                      <div key={index} className="group">
                        <div className="bg-white/80 backdrop-blur-sm p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-200 hover:border-orange-300 transition-all duration-500 hover:shadow-2xl transform hover:scale-105 h-full">
                          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">{feature.title}</h3>
                          <p className="text-base sm:text-lg text-gray-600">{feature.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Get Started */}
              {activeSection === 1 && (
                <div className="w-full animate-fadeIn">
                  <div className="text-center mb-8 sm:mb-12">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-600 to-gray-700 bg-clip-text text-transparent">
                      Get Started in 5 Steps
                    </h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    {[
                      { step: "01", title: "Check Availability", desc: "Look below for container availability if not join our waiting list" },
                      { step: "02", title: "Sign Up to Our System", desc: "Create an account and sign our contract" },
                      { step: "03", title: "Rent Your Contianer", desc: "Rent a container digitally through stripe" },
                      { step: "04", title: "Visit Our Office", desc: "Come in to see us so we can verify your identification" },
                      { step: "05", title: "Get Access", desc: "Receive gate code and move in" }
                    ].map((item, index) => (
                      <div key={index} className="group text-center">
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 text-xl sm:text-2xl font-bold text-white group-hover:scale-110 transition-transform duration-300 shadow-lg">
                          {item.step}
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">{item.title}</h3>
                        <p className="text-sm sm:text-base text-gray-600">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FAQ */}
              {activeSection === 2 && (
                <div className="w-full animate-fadeIn">
                  <div className="text-center mb-8 sm:mb-12">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-600 to-gray-700 bg-clip-text text-transparent">
                      Frequently Asked Questions
                    </h2>
                    <p className="text-lg sm:text-xl text-gray-600">
                      Need answers? Call us at <span className="text-orange-500 font-semibold">0408 805 996</span>
                    </p>
                  </div>
                  
                  <div className="max-w-4xl mx-auto">
                    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                      {faqs.map((faq, index) => (
                        <div key={index} className="group">
                          <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-orange-300 transition-all duration-300 hover:shadow-lg h-full">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 group-hover:text-orange-500 transition-colors duration-300">
                              {faq.question}
                            </h3>
                            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{faq.answer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Contact */}
              {activeSection === 3 && (
                <div className="w-full animate-fadeIn">
                  <div className="text-center mb-8 sm:mb-12">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-600 to-gray-700 bg-clip-text text-transparent">
                      Contact Us
                    </h2>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {[
                      { 
                        title: "Address", 
                        info: "14 Weaver St, Edwardstown SA 5039"
                      },
                      { 
                        title: "Phone", 
                        info: "0408 805 996"
                      },
                      { 
                        title: "Email", 
                        info: "storage@storehere.com.au"
                      }
                    ].map((contact, index) => (
                      <div key={index} className="group">
                        <div className="bg-white/80 backdrop-blur-sm p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-200 hover:border-orange-300 transition-all duration-500 hover:shadow-2xl transform hover:scale-105 h-full text-center">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">{contact.title}</h3>
                          <p className="text-sm sm:text-base text-gray-600">{contact.info}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-center mt-8 sm:mt-12">
                    <div className="text-gray-500 text-xs sm:text-sm space-y-1 sm:space-y-2">
                      <p>Short or long term storage solutions for commercial or residential storage</p>
                      <p>©2022 by Store Here</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Container Availability Section */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-orange-50 via-white to-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {loadingContainers ? (
              <div className="bg-white/80 backdrop-blur-sm p-8 sm:p-12 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-lg">
                <h3 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-600 to-gray-700 bg-clip-text text-transparent mb-4">
                  Checking Availability
                </h3>
                <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : containersAvailable ? (
              <div className="bg-white/80 backdrop-blur-sm p-8 sm:p-12 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-lg">
                <h3 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-600 to-gray-700 bg-clip-text text-transparent mb-4">
                  Containers Available
                </h3>
                <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">
                  Great news! We have storage containers available right now. 
                  Get started with your storage solution today.
                </p>
                <a 
                  href="/SignUp.js" 
                  className="inline-block bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 sm:px-10 py-3 sm:py-4 rounded-full text-lg sm:text-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Get a Container
                </a>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-sm p-8 sm:p-12 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-lg">
                <h3 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-600 to-gray-700 bg-clip-text text-transparent mb-4">
                  Currently Full
                </h3>
                <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">
                  All containers are currently occupied. Join our waiting list to be notified 
                  when containers become available. We get notified when you join our waiting list and contact quickly to get you a container.
                </p>
                <form onSubmit={handleWaitingListSubmit} className="max-w-md mx-auto">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <input
                      type="email"
                      value={waitingListEmail}
                      onChange={(e) => setWaitingListEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="flex-1 px-4 py-4 border border-gray-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base sm:text-lg min-h-[48px]"
                      required
                      disabled={submitStatus === 'loading'}
                    />
                    <button
                      type="submit"
                      disabled={submitStatus === 'loading'}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 sm:px-8 py-4 rounded-full font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[48px] flex items-center justify-center whitespace-nowrap"
                    >
                      {submitStatus === 'loading' ? 'Joining...' : 'Join List'}
                    </button>
                  </div>
                  
                  {submitStatus === 'success' && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm">
                        Thank you! You've been added to our waiting list. We'll notify you when containers become available.
                      </p>
                    </div>
                  )}
                  
                  {submitStatus === 'duplicate' && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-800 text-sm">
                        This email is already on our waiting list. You'll be notified when containers become available.
                      </p>
                    </div>
                  )}
                  
                  {submitStatus === 'error' && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-800 text-sm">
                        Sorry, there was an error adding you to the waiting list. Please try again.
                      </p>
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative w-full bg-black">
        <div className="w-full">
          <img 
            src={`${S3_BUCKET_URL}/photos/Black Background Header panel.jpg`} 
            alt="StoreHere Footer" 
            className="w-full h-auto object-cover object-center min-h-[80px] sm:min-h-[100px]"
          />
        </div>
      </footer>
    </div>
  );
};

export default HomePage;