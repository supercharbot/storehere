import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, MapPin, Package, MoreVertical } from 'lucide-react';
import { getSites, createSite, deleteSite, getContainers, updateContainer, createContainer } from './dynamodb';

// Container status configurations
const statusConfig = {
  available: { color: 'bg-gray-400', label: 'Available', textColor: 'text-white' },
  'rented-paid': { color: 'bg-green-500', label: 'Rented - Paid', textColor: 'text-white' },
  'rented-unpaid': { color: 'bg-yellow-500', label: 'Rented - Unpaid', textColor: 'text-white' },
  abandoned: { color: 'bg-red-500', label: 'Abandoned', textColor: 'text-white' }
};

function SiteLocations({ onSiteSelect }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      setLoading(true);
      const sitesData = await getSites();
      setSites(sitesData || []);
    } catch (error) {
      console.error('Error loading sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSite = async () => {
    if (newSiteName.trim()) {
      try {
        const newSite = await createSite({
          name: newSiteName,
          address: newSiteAddress
        });
        setSites([...sites, newSite]);
        setNewSiteName('');
        setNewSiteAddress('');
        setShowAddModal(false);
      } catch (error) {
        console.error('Error creating site:', error);
        alert('Error creating site');
      }
    }
  };

  const handleDeleteSite = async (siteId) => {
    if (window.confirm('Are you sure you want to delete this site?')) {
      try {
        await deleteSite(siteId);
        setSites(sites.filter(site => site.id !== siteId));
      } catch (error) {
        console.error('Error deleting site:', error);
        alert('Error deleting site');
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading sites...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Site Locations</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} />
          Add Site
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No sites found. Add your first site to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map(site => (
            <div key={site.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="text-orange-500" size={24} />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">{site.name}</h3>
                      <p className="text-gray-600 text-sm">{site.address}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">
                    {site.containerCapacity || 40} containers
                  </span>
                  <button
                    onClick={() => onSiteSelect(site)}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Manage
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Site</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Site Name"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="text"
                placeholder="Address"
                value={newSiteAddress}
                onChange={(e) => setNewSiteAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddSite}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg"
              >
                Add Site
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContainerGrid({ site, onBack }) {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContainers, setSelectedContainers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContainerNumber, setNewContainerNumber] = useState('');

  useEffect(() => {
    loadContainers();
  }, [site.id]);

  useEffect(() => {
    setShowBulkActions(selectedContainers.length > 0);
  }, [selectedContainers]);

  const loadContainers = async () => {
    try {
      setLoading(true);
      const containersData = await getContainers(site.id);
      setContainers(containersData || []);
    } catch (error) {
      console.error('Error loading containers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter containers and determine status based on payment data
  const containerItems = containers.filter(item => item.type === 'container').map(container => {
    // Auto-determine status based on payment data
    let status = container.status;
    
    if (container.subscriptionStatus === 'active' && container.securityBondStatus === 'paid') {
      status = 'rented-paid';
    } else if (container.subscriptionStatus === 'past_due' || container.overdueSince) {
      status = 'rented-unpaid';
    } else if (container.subscriptionStatus === 'canceled' || container.subscriptionStatus === 'inactive') {
      status = 'available';
    }
    
    return { ...container, status };
  });
  
  const leftSide = containerItems.filter(c => {
    const num = parseInt(c.number.substring(1));
    return num <= 20;
  });
  
  const rightSide = containerItems.filter(c => {
    const num = parseInt(c.number.substring(1));
    return num > 20;
  });

  const toggleContainerSelection = (container) => {
    setSelectedContainers(prev => 
      prev.includes(container.number) 
        ? prev.filter(num => num !== container.number)
        : [...prev, container.number]
    );
  };

  const handleAddContainer = async () => {
    if (newContainerNumber.trim()) {
      try {
        await createContainer(site.id, { number: newContainerNumber });
        await loadContainers();
        setNewContainerNumber('');
        setShowAddModal(false);
      } catch (error) {
        console.error('Error creating container:', error);
        alert('Error creating container: ' + error.message);
      }
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    try {
      const updates = selectedContainers.map(containerNumber => 
        updateContainer(site.id, containerNumber, { status: newStatus })
      );
      
      await Promise.all(updates);
      await loadContainers();
      setSelectedContainers([]);
      setShowBulkActions(false);
    } catch (error) {
      console.error('Error updating containers:', error);
      alert('Error updating containers');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading containers...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{site.name}</h1>
            <p className="text-gray-600">{site.address}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={20} />
            Add Container
          </button>
          
          {showBulkActions && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedContainers.length} selected</span>
              <div className="relative group">
                <button className="bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <MoreVertical size={16} />
                  Bulk Actions
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-48 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    onClick={() => handleBulkStatusChange('available')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                  >
                    Mark as Available
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange('rented-paid')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                  >
                    Mark as Rented - Paid
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange('rented-unpaid')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                  >
                    Mark as Rented - Unpaid
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange('abandoned')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                  >
                    Mark as Abandoned
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-6 p-4 bg-white rounded-lg border border-gray-200">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${config.color}`}></div>
            <span className="text-sm text-gray-600">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Container Grid */}
      <div className="flex gap-8">
        {/* Left Side */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Section A (Left)</h3>
          {leftSide.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No containers in this section yet
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {leftSide.map((container) => {
                const config = statusConfig[container.status];
                const isSelected = selectedContainers.includes(container.number);
                
                return (
                  <div
                    key={container.number}
                    onClick={() => toggleContainerSelection(container)}
                    className={`${config.color} ${config.textColor} rounded-lg p-4 cursor-pointer transition-all hover:opacity-80 ${
                      isSelected ? 'ring-4 ring-blue-300' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg">{container.number}</div>
                        {container.stripeCustomerId && (
                          <div className="text-sm opacity-90">
                            {container.subscriptionStatus === 'active' ? 'Active' : 
                             container.subscriptionStatus === 'past_due' ? 'Past Due' : 
                             container.subscriptionStatus === 'canceled' ? 'Canceled' : 'Inactive'}
                          </div>
                        )}
                      </div>
                      <Package size={20} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Section B (Right)</h3>
          {rightSide.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No containers in this section yet
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {rightSide.map((container) => {
                const config = statusConfig[container.status];
                const isSelected = selectedContainers.includes(container.number);
                
                return (
                  <div
                    key={container.number}
                    onClick={() => toggleContainerSelection(container)}
                    className={`${config.color} ${config.textColor} rounded-lg p-4 cursor-pointer transition-all hover:opacity-80 ${
                      isSelected ? 'ring-4 ring-blue-300' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg">{container.number}</div>
                        {container.stripeCustomerId && (
                          <div className="text-sm opacity-90">
                            {container.subscriptionStatus === 'active' ? 'Active' : 
                             container.subscriptionStatus === 'past_due' ? 'Past Due' : 
                             container.subscriptionStatus === 'canceled' ? 'Canceled' : 'Inactive'}
                          </div>
                        )}
                      </div>
                      <Package size={20} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Container Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Container</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Container Number (e.g., A01, B15)"
                value={newContainerNumber}
                onChange={(e) => setNewContainerNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddContainer}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg"
              >
                Add Container
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Containers() {
  const [currentView, setCurrentView] = useState('sites');
  const [selectedSite, setSelectedSite] = useState(null);

  const handleSiteSelect = (site) => {
    setSelectedSite(site);
    setCurrentView('containers');
  };

  const handleBackToSites = () => {
    setCurrentView('sites');
    setSelectedSite(null);
  };

  return (
    <>
      {currentView === 'sites' && (
        <SiteLocations onSiteSelect={handleSiteSelect} />
      )}
      {currentView === 'containers' && selectedSite && (
        <ContainerGrid site={selectedSite} onBack={handleBackToSites} />
      )}
    </>
  );
}

export default Containers;