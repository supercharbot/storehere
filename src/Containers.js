import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, MapPin, Package, MoreVertical, Upload, Image, X } from 'lucide-react';
import AWS from 'aws-sdk';
import { getSites, createSite, deleteSite, getContainers, updateContainer, createContainer } from './dynamodb';

// Configure AWS
AWS.config.update({
  region: process.env.REACT_APP_AWS_REGION,
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();

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
          {sites.map((site) => (
            <div key={site.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-100 rounded-lg p-2">
                      <MapPin className="text-orange-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{site.name}</h3>
                      {site.address && (
                        <p className="text-gray-600 text-sm">{site.address}</p>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => handleDeleteSite(site.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Delete site"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => onSiteSelect(site)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg transition-colors"
                >
                  Manage Containers
                </button>
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
  const [siteMapFile, setSiteMapFile] = useState(null);
  const [siteMapPreview, setSiteMapPreview] = useState(null);
  const [uploadingSiteMap, setUploadingSiteMap] = useState(false);
  const [siteMapUrl, setSiteMapUrl] = useState(null);

  useEffect(() => {
    loadContainers();
  }, [site.id]);

  useEffect(() => {
    setShowBulkActions(selectedContainers.length > 0);
  }, [selectedContainers]);

  useEffect(() => {
    loadExistingSiteMap();
  }, [site.id]);

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

  const loadExistingSiteMap = async () => {
    try {
      // List objects in S3 with site prefix
      const listParams = {
        Bucket: 'storehere-agreements',
        Prefix: `site-map/${site.id}_`
      };
      
      const result = await s3.listObjectsV2(listParams).promise();
      
      if (result.Contents && result.Contents.length > 0) {
        // Get the most recent site map (sort by last modified)
        const latestSiteMap = result.Contents.sort((a, b) => 
          new Date(b.LastModified) - new Date(a.LastModified)
        )[0];
        
        // Generate signed URL for viewing the image
        const signedUrl = await s3.getSignedUrlPromise('getObject', {
          Bucket: 'storehere-agreements',
          Key: latestSiteMap.Key,
          Expires: 3600 // 1 hour
        });
        
        setSiteMapUrl(signedUrl);
      }
    } catch (error) {
      console.error('Error loading existing site map:', error);
      // Don't show error to user - just means no existing site map or no permissions
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
  
  // Sort containers and fill left side first
  const sortedContainers = containerItems.sort((a, b) => {
    // Handle numeric sorting for numbers like 1, 2, 3
    const aNum = parseInt(a.number);
    const bNum = parseInt(b.number);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    
    // Handle alphanumeric sorting for letters like A, B, C or A01, A02
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  const leftSideCapacity = 20;
  const leftSide = sortedContainers.slice(0, leftSideCapacity);
  const rightSide = sortedContainers.slice(leftSideCapacity);

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
      const updates = selectedContainers.map(containerNumber => {
        // Update both status and payment fields to ensure consistency
        const updateData = { status: newStatus };
        
        // If marking as available, clear payment statuses
        if (newStatus === 'available') {
          updateData.subscriptionStatus = 'canceled';
          updateData.securityBondStatus = null;
          updateData.customerEmail = null;
          updateData.overdueSince = null;
        }
        // If marking as rented-paid, set payment statuses
        else if (newStatus === 'rented-paid') {
          updateData.subscriptionStatus = 'active';
          updateData.securityBondStatus = 'paid';
        }
        // If marking as rented-unpaid, set payment statuses
        else if (newStatus === 'rented-unpaid') {
          updateData.subscriptionStatus = 'past_due';
          updateData.securityBondStatus = 'paid';
        }
        
        return updateContainer(site.id, containerNumber, updateData);
      });
      
      await Promise.all(updates);
      await loadContainers();
      setSelectedContainers([]);
      setShowBulkActions(false);
    } catch (error) {
      console.error('Error updating containers:', error);
      alert('Error updating containers');
    }
  };

  const handleSiteMapFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSiteMapFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setSiteMapPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select a valid image file');
    }
  };

  const handleSiteMapDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSiteMapFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setSiteMapPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please drop a valid image file');
    }
  };

  const handleSiteMapDragOver = (event) => {
    event.preventDefault();
  };

  const uploadSiteMapToS3 = async () => {
    if (!siteMapFile) return;

    try {
      setUploadingSiteMap(true);
      
      // Convert file to base64 for API upload (following the same pattern as signature upload)
      const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(siteMapFile);
      });

      // Upload via API (following the same pattern as signature upload)
      const fileName = `site-map/${site.id}_${Date.now()}_${siteMapFile.name}`;
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/upload-sitemap`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: fileName,
          siteInfo: {
            siteId: site.id,
            siteName: site.name
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      const result = await response.json();
      setSiteMapUrl(fileName);
      
      alert('Site map uploaded successfully!');
      
      // Clear the form
      setSiteMapFile(null);
      setSiteMapPreview(null);
      
      // Reload existing site map after short delay
      setTimeout(() => {
        loadExistingSiteMap();
      }, 1000);
      
    } catch (error) {
      console.error('Error uploading site map:', error);
      alert('Error uploading site map: ' + error.message);
    } finally {
      setUploadingSiteMap(false);
    }
  };

  const clearSiteMap = () => {
    setSiteMapFile(null);
    setSiteMapPreview(null);
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
            {site.address && (
              <p className="text-gray-600">{site.address}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} />
          Add Container
        </button>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-blue-800 font-medium">
              {selectedContainers.length} container{selectedContainers.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              {Object.entries(statusConfig).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => handleBulkStatusChange(status)}
                  className={`px-3 py-1 rounded text-sm font-medium ${config.color} ${config.textColor} hover:opacity-80`}
                >
                  Mark as {config.label}
                </button>
              ))}
              <button
                onClick={() => setSelectedContainers([])}
                className="px-3 py-1 rounded text-sm font-medium bg-gray-300 text-gray-700 hover:bg-gray-400"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Container Grid - Original Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Left Side (1-{leftSideCapacity})</h2>
          {leftSide.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              No containers on left side
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {leftSide.map((container) => {
                const config = statusConfig[container.status] || statusConfig.available;
                const isSelected = selectedContainers.includes(container.number);
                return (
                  <div
                    key={container.number}
                    onClick={() => toggleContainerSelection(container)}
                    className={`
                      relative aspect-square rounded-lg flex flex-col items-center justify-center text-white font-bold text-lg cursor-pointer border-4 transition-all
                      ${config.color} ${config.textColor}
                      ${isSelected ? 'border-blue-500 scale-105' : 'border-transparent hover:scale-105'}
                    `}
                  >
                    <div className="text-center">
                      <div className="text-xl font-bold mb-1">{container.number}</div>
                      {container.customerEmail && (
                        <div className="text-xs opacity-75 leading-tight">
                          {container.subscriptionStatus === 'active' ? 'Active' : 
                           container.subscriptionStatus === 'past_due' ? 'Past Due' : 
                           container.subscriptionStatus === 'canceled' ? 'Canceled' : 'Inactive'}
                        </div>
                      )}
                    </div>
                    <Package size={20} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Right Side ({leftSideCapacity + 1}+)</h2>
          {rightSide.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              No containers on right side
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {rightSide.map((container) => {
                const config = statusConfig[container.status] || statusConfig.available;
                const isSelected = selectedContainers.includes(container.number);
                return (
                  <div
                    key={container.number}
                    onClick={() => toggleContainerSelection(container)}
                    className={`
                      relative aspect-square rounded-lg flex flex-col items-center justify-center text-white font-bold text-lg cursor-pointer border-4 transition-all
                      ${config.color} ${config.textColor}
                      ${isSelected ? 'border-blue-500 scale-105' : 'border-transparent hover:scale-105'}
                    `}
                  >
                    <div className="text-center">
                      <div className="text-xl font-bold mb-1">{container.number}</div>
                      {container.customerEmail && (
                        <div className="text-xs opacity-75 leading-tight">
                          {container.subscriptionStatus === 'active' ? 'Active' : 
                           container.subscriptionStatus === 'past_due' ? 'Past Due' : 
                           container.subscriptionStatus === 'canceled' ? 'Canceled' : 'Inactive'}
                        </div>
                      )}
                    </div>
                    <Package size={20} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Site Map Section */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <MapPin size={24} />
          Site Map Management
        </h2>
        
        <div className="space-y-4">
          {/* Show existing site map if available */}
          {siteMapUrl && !siteMapPreview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">Current Site Map:</span>
                <button
                  onClick={() => setSiteMapUrl(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  Replace Map
                </button>
              </div>
              <div className="mb-3">
                <img
                  src={siteMapUrl}
                  alt="Current site map"
                  className="max-w-full h-auto max-h-48 rounded border object-contain"
                />
              </div>
              <button
                onClick={() => window.open(siteMapUrl, '_blank')}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
              >
                <Image size={16} />
                View Full Size
              </button>
            </div>
          )}
          
          {!siteMapPreview && !siteMapUrl ? (
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors cursor-pointer"
              onDrop={handleSiteMapDrop}
              onDragOver={handleSiteMapDragOver}
              onClick={() => document.getElementById('siteMapInput').click()}
            >
              <Upload size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-600 mb-2">Upload Site Map</p>
              <p className="text-sm text-gray-500 mb-4">
                Drag and drop an image file here, or click to select
              </p>
              <input
                id="siteMapInput"
                type="file"
                accept="image/*"
                onChange={handleSiteMapFileSelect}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Image size={16} />
                Supported: JPG, PNG, GIF, WebP
              </div>
            </div>
          ) : siteMapPreview ? (
            <div className="space-y-4">
              <div className="relative bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Preview:</span>
                  <button
                    onClick={clearSiteMap}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                <img
                  src={siteMapPreview}
                  alt="Site map preview"
                  className="max-w-full h-auto max-h-64 rounded border"
                />
                <p className="text-sm text-gray-600 mt-2">{siteMapFile?.name}</p>
              </div>
              
              <button
                onClick={uploadSiteMapToS3}
                disabled={uploadingSiteMap}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center gap-2"
              >
                <Upload size={20} />
                {uploadingSiteMap ? 'Uploading...' : 'Save Site Map'}
              </button>
            </div>
          ) : null}
          
          {siteMapUrl && siteMapPreview && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                ✓ Site map uploaded successfully and saved to cloud storage
              </p>
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
                placeholder="Container Number (e.g., A, B, C or 1, 2, 3)"
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