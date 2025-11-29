import React, { useState, useEffect } from 'react';
import { Plane, Wallet, LayoutDashboard, Save, FolderOpen, Plus, Trash2, Map as MapIcon, X, ChevronDown, ExternalLink, Home } from 'lucide-react';
import { TripPlanner } from './components/TripPlanner';
import { ExpenseTracker } from './components/ExpenseTracker';
import { Dashboard } from './components/Dashboard';
import { Traveler, Trip, TripData, Expense, ExpenseFolder, Activity } from './types';
import { Button, Card } from './components/UIComponents';

const INITIAL_TRAVELERS: Traveler[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Charlie' }
];

const DEFAULT_FOLDERS: ExpenseFolder[] = [
  { id: 'general', name: 'General' }
];

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Accommodation', 'Activity', 'Other'];
const DEFAULT_CURRENCY = 'USD';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'expenses'>('dashboard');
  
  // App State - now bundled into a Project structure
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  
  const [tripDetails, setTripDetails] = useState<Trip | null>(null);
  const [travelers, setTravelers] = useState<Traveler[]>(INITIAL_TRAVELERS);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseFolders, setExpenseFolders] = useState<ExpenseFolder[]>(DEFAULT_FOLDERS);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [tripName, setTripName] = useState<string>("My Awesome Trip");

  const [savedTrips, setSavedTrips] = useState<{id: string, name: string, lastUpdated: string}[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);

  // Map State
  const [showSideMap, setShowSideMap] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<string>('overview'); // 'overview' | 'all-days' | 'day-1' | 'day-2' etc.

  // Load Saved Trip List on Mount
  useEffect(() => {
    const savedList = localStorage.getItem('wanderlust_projects');
    if (savedList) {
      setSavedTrips(JSON.parse(savedList));
    }
    
    // Attempt to load last active trip
    const lastActiveId = localStorage.getItem('wanderlust_active_id');
    if (lastActiveId) {
      loadTrip(lastActiveId);
    }
  }, []);

  // Reset map view when trip changes
  useEffect(() => {
      setMapViewMode('overview');
  }, [activeTripId]);

  const createNewTrip = () => {
    const newId = Date.now().toString();
    const newName = "New Trip " + new Date().toLocaleDateString();
    
    // Initialize State
    setActiveTripId(newId);
    setTripName(newName);
    setTripDetails(null);
    setTravelers(INITIAL_TRAVELERS);
    setExpenses([]);
    setExpenseFolders(DEFAULT_FOLDERS);
    setCategories(DEFAULT_CATEGORIES);
    setCurrency(DEFAULT_CURRENCY);
    
    // Fix: Define timestamp first to avoid reference before declaration
    const timestamp = new Date().toISOString();

    // Initial Data Object
    const initialData: TripData = {
        id: newId,
        name: newName,
        lastUpdated: timestamp,
        trip: null,
        travelers: INITIAL_TRAVELERS,
        expenses: [],
        expenseFolders: DEFAULT_FOLDERS,
        categories: DEFAULT_CATEGORIES,
        currency: DEFAULT_CURRENCY
    };

    // Save Data & Metadata immediately
    const newMeta = { id: newId, name: newName, lastUpdated: timestamp };
    const updatedList = [newMeta, ...savedTrips];
    setSavedTrips(updatedList);
    
    localStorage.setItem('wanderlust_projects', JSON.stringify(updatedList));
    localStorage.setItem(`wanderlust_data_${newId}`, JSON.stringify(initialData));
    localStorage.setItem('wanderlust_active_id', newId);
    
    setShowLoadMenu(false);
    setActiveTab('planner'); // Go to planner for new trip
  };

  const saveCurrentTrip = () => {
    if (!activeTripId) {
      createNewTrip();
      return;
    }

    const fullData: TripData = {
      id: activeTripId,
      name: tripName,
      lastUpdated: new Date().toISOString(),
      trip: tripDetails,
      travelers,
      expenses,
      expenseFolders,
      categories,
      currency
    };

    // Save full data
    localStorage.setItem(`wanderlust_data_${activeTripId}`, JSON.stringify(fullData));

    // Update metadata list
    const updatedList = savedTrips.map(t => 
      t.id === activeTripId ? { ...t, name: tripName, lastUpdated: fullData.lastUpdated } : t
    );
    // If somehow ID wasn't in list (legacy), add it
    if (!updatedList.find(t => t.id === activeTripId)) {
      updatedList.unshift({ id: activeTripId, name: tripName, lastUpdated: fullData.lastUpdated });
    }

    setSavedTrips(updatedList);
    localStorage.setItem('wanderlust_projects', JSON.stringify(updatedList));
    alert("Trip saved successfully!");
  };

  const loadTrip = (id: string) => {
    const dataStr = localStorage.getItem(`wanderlust_data_${id}`);
    if (dataStr) {
      try {
        const data: TripData = JSON.parse(dataStr);
        setActiveTripId(data.id);
        setTripName(data.name);
        setTripDetails(data.trip);
        setTravelers(data.travelers);
        setExpenses(data.expenses);
        setExpenseFolders(data.expenseFolders || DEFAULT_FOLDERS);
        setCategories(data.categories || DEFAULT_CATEGORIES);
        setCurrency(data.currency || DEFAULT_CURRENCY);
        localStorage.setItem('wanderlust_active_id', data.id);
        setShowLoadMenu(false);
      } catch (e) {
        console.error("Failed to load trip", e);
        alert("Error loading trip data. The file might be corrupted.");
      }
    } else {
        alert("Trip data not found. It may have been deleted.");
    }
  };

  const deleteTrip = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this trip?")) {
      const updatedList = savedTrips.filter(t => t.id !== id);
      setSavedTrips(updatedList);
      localStorage.setItem('wanderlust_projects', JSON.stringify(updatedList));
      localStorage.removeItem(`wanderlust_data_${id}`);
      
      if (activeTripId === id) {
        // If we deleted current, reset
        setActiveTripId(null);
        setTripDetails(null);
        setTravelers(INITIAL_TRAVELERS);
        setExpenses([]);
        setExpenseFolders(DEFAULT_FOLDERS);
        setCategories(DEFAULT_CATEGORIES);
        setCurrency(DEFAULT_CURRENCY);
        setTripName("My Awesome Trip");
        setActiveTab('dashboard');
      }
    }
  };

  // Auto-save effect (Debounced)
  useEffect(() => {
    if (!activeTripId) return;
    
    const timer = setTimeout(() => {
      const fullData: TripData = {
        id: activeTripId,
        name: tripName,
        lastUpdated: new Date().toISOString(),
        trip: tripDetails,
        travelers,
        expenses,
        expenseFolders,
        categories,
        currency
      };
      localStorage.setItem(`wanderlust_data_${activeTripId}`, JSON.stringify(fullData));
    }, 1000);

    return () => clearTimeout(timer);
  }, [tripDetails, travelers, expenses, expenseFolders, categories, currency, tripName, activeTripId]);

  // Smart Map Toggle
  const toggleSideMap = () => {
    const willShow = !showSideMap;
    setShowSideMap(willShow);
    
    if (willShow) {
        // Check if we have enough locations to show a route
        const hasLocations = tripDetails?.itinerary?.some(day => 
            day.activities.some(a => a.location && a.location !== 'Location' && a.location.trim() !== '')
        );
        
        // If we have locations, show the full route map by default
        if (hasLocations) {
            setMapViewMode('all-days');
        } else {
            setMapViewMode('overview');
        }
    }
  };

  // Helper to generate map URL for external link
  const getExternalMapUrl = () => {
      if (!tripDetails?.itinerary) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tripDetails?.destination || '')}`;

      const allLocations = tripDetails.itinerary.flatMap(day => 
          day.activities.map(a => a.location).filter(l => l && l !== 'Location' && l.trim() !== '')
      );
      const uniqueLocations = allLocations.filter((item, pos, arr) => !pos || item !== arr[pos - 1]);

      if (uniqueLocations.length < 2) {
           return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(uniqueLocations[0] || tripDetails?.destination || '')}`;
      }

      const origin = uniqueLocations[0];
      const dest = uniqueLocations[uniqueLocations.length - 1];
      const waypoints = uniqueLocations.slice(1, -1).map(l => encodeURIComponent(l)).join('|');

      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  };

  // Helper to generate map URL for embed
  const getMapEmbedUrl = () => {
    if (!tripDetails?.destination) return "https://maps.google.com/maps?q=World&t=&z=2&ie=UTF8&iwloc=&output=embed";

    // Overview Mode
    if (mapViewMode === 'overview') {
        return `https://maps.google.com/maps?q=${encodeURIComponent(tripDetails.destination)}&t=&z=10&ie=UTF8&iwloc=&output=embed`;
    }

    // Full Trip Route Mode
    if (mapViewMode === 'all-days') {
        if (!tripDetails.itinerary) return `https://maps.google.com/maps?q=${encodeURIComponent(tripDetails.destination)}&t=&z=10&ie=UTF8&iwloc=&output=embed`;

        const allLocations = tripDetails.itinerary.flatMap(day => 
            day.activities
                .map(a => a.location)
                .filter(l => l && l !== 'Location' && l.trim() !== '')
        );

        if (allLocations.length === 0) {
             return `https://maps.google.com/maps?q=${encodeURIComponent(tripDetails.destination)}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
        }
        
        // Get all unique locations to show the full scope of the trip
        const uniqueLocations = Array.from(new Set(allLocations));
        
        // Embed limits are strict, prioritize first 20 stops
        const limitedLocations = uniqueLocations.slice(0, 20);

        if (limitedLocations.length === 1) {
            return `https://maps.google.com/maps?q=${encodeURIComponent(limitedLocations[0] as string)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
        }

        const origin = limitedLocations[0] as string;
        const dest = limitedLocations[limitedLocations.length - 1] as string;
        const waypoints = limitedLocations.slice(1, -1);
        
        // Use standard query format which acts as directions in embed
        let query = `from:${encodeURIComponent(origin)}`;
        waypoints.forEach(wp => query += `+to:${encodeURIComponent(wp as string)}`);
        query += `+to:${encodeURIComponent(dest)}`;

        return `https://maps.google.com/maps?q=${query}&t=&z=10&ie=UTF8&iwloc=&output=embed&travelmode=driving`;
    }

    // Day Route Mode
    if (mapViewMode.startsWith('day-')) {
        const dayIndex = parseInt(mapViewMode.split('-')[1]);
        const dayPlan = tripDetails.itinerary?.[dayIndex];
        
        if (!dayPlan || !dayPlan.activities || dayPlan.activities.length === 0) {
            return `https://maps.google.com/maps?q=${encodeURIComponent(tripDetails.destination)}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
        }

        const locations = dayPlan.activities
            .map(a => a.location)
            .filter(l => l && l !== 'Location' && l.trim() !== '')
            .map(l => encodeURIComponent(l));
        
        if (locations.length === 0) {
             return `https://maps.google.com/maps?q=${encodeURIComponent(tripDetails.destination)}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
        }
        
        if (locations.length === 1) {
            return `https://maps.google.com/maps?q=${locations[0]}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
        }

        const origin = locations[0];
        const dest = locations[locations.length - 1];
        const waypoints = locations.slice(1, -1);
        
        let query = `from:${origin}`;
        waypoints.forEach(wp => query += `+to:${wp}`);
        query += `+to:${dest}`;

        return `https://maps.google.com/maps?q=${query}&t=&z=12&ie=UTF8&iwloc=&output=embed&travelmode=driving`;
    }

    return `https://maps.google.com/maps?q=${encodeURIComponent(tripDetails.destination)}&t=&z=10&ie=UTF8&iwloc=&output=embed`;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans transition-colors duration-200">
      {/* Header - Fixed Height */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm z-50 dark:border-b dark:border-gray-700">
        <div className="w-full px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-1.5 rounded-lg flex-shrink-0">
                <Plane className="h-5 w-5 text-white" />
              </div>
              <input 
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="font-bold text-lg tracking-tight text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary focus:outline-none transition-colors w-24 sm:w-48 lg:w-auto"
              />
            </div>
            
            {/* Center Navigation - Now containing Dashboard, Planner, Map Toggle, and Wallet */}
            <nav className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mx-2 sm:mx-4 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === 'dashboard' 
                    ? 'bg-white dark:bg-gray-600 text-primary dark:text-teal-400 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Home className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Home</span>
              </button>

              <button
                onClick={() => setActiveTab('planner')}
                className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === 'planner' 
                    ? 'bg-white dark:bg-gray-600 text-primary dark:text-teal-400 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Plan</span>
              </button>
              
              <button
                onClick={toggleSideMap}
                className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  showSideMap 
                    ? 'bg-white dark:bg-gray-600 text-primary dark:text-teal-400 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <MapIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Map</span>
              </button>

              <button
                onClick={() => setActiveTab('expenses')}
                className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === 'expenses' 
                    ? 'bg-white dark:bg-gray-600 text-primary dark:text-teal-400 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Wallet className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Wallet</span>
              </button>
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowLoadMenu(!showLoadMenu)} className="px-2 sm:px-3">
                    <FolderOpen className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Trips</span>
                </Button>
                
                {showLoadMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">My Trips</span>
                        <Button size="sm" variant="ghost" onClick={createNewTrip} className="h-6 text-xs px-2">
                            <Plus className="w-3 h-3 mr-1" /> New
                        </Button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {savedTrips.length === 0 && <div className="px-4 py-3 text-sm text-gray-400 text-center">No saved trips</div>}
                        {savedTrips.map(trip => (
                            <div 
                                key={trip.id}
                                onClick={() => loadTrip(trip.id)}
                                className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center group ${activeTripId === trip.id ? 'bg-teal-50 dark:bg-teal-900/30 border-l-4 border-primary' : ''}`}
                            >
                                <div>
                                    <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">{trip.name}</div>
                                    <div className="text-xs text-gray-400">{new Date(trip.lastUpdated).toLocaleDateString()}</div>
                                </div>
                                <button 
                                    onClick={(e) => deleteTrip(e, trip.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              
              <Button size="sm" onClick={saveCurrentTrip} className="px-2 sm:px-3">
                 <Save className="w-4 h-4 sm:mr-2" />
                 <span className="hidden sm:inline">Save</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area - Flex Grow with Split View */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Scrollable Content */}
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${showSideMap ? 'mr-0' : ''}`}>
          <div className="max-w-6xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8">
            {activeTab === 'dashboard' && (
                <Dashboard 
                    trip={tripDetails}
                    activeTripId={activeTripId}
                    expenses={expenses}
                    savedTrips={savedTrips}
                    onLoadTrip={(id) => { loadTrip(id); setActiveTab('dashboard'); }}
                    onCreateTrip={createNewTrip}
                    currency={currency}
                    onNavigate={(tab) => setActiveTab(tab as any)}
                />
            )}

            {activeTab === 'planner' && (
              <TripPlanner 
                trip={tripDetails} 
                onSaveTrip={setTripDetails} 
                currency={currency}
                onCurrencyChange={setCurrency}
              />
            )}
            
            {activeTab === 'expenses' && (
              <ExpenseTracker 
                travelers={travelers} 
                onUpdateTravelers={setTravelers}
                expenses={expenses}
                onUpdateExpenses={setExpenses}
                folders={expenseFolders}
                onUpdateFolders={setExpenseFolders}
                categories={categories}
                onUpdateCategories={setCategories}
                currency={currency}
              />
            )}
          </div>
        </main>

        {/* Side Map Panel */}
        {showSideMap && (
           <aside className="w-1/3 min-w-[350px] max-w-[500px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col shadow-xl z-40 transition-all duration-300">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col gap-2">
                  <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2 flex-1 mr-2">
                          <MapIcon className="w-4 h-4 text-gray-500" />
                          <div className="relative flex-1">
                              <select 
                                 className="w-full text-sm py-1 pl-2 pr-8 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-primary appearance-none dark:text-white"
                                 value={mapViewMode}
                                 onChange={(e) => setMapViewMode(e.target.value)}
                              >
                                  <option value="overview">Destination Overview</option>
                                  <option value="all-days">Full Trip Route</option>
                                  {tripDetails?.itinerary?.map((day, idx) => (
                                      <option key={idx} value={`day-${idx}`}>Day {day.day} Route</option>
                                  ))}
                              </select>
                              <ChevronDown className="w-4 h-4 absolute right-2 top-1.5 text-gray-400 pointer-events-none" />
                          </div>
                      </div>
                      <button onClick={() => setShowSideMap(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  {mapViewMode !== 'overview' && (
                      <a 
                          href={getExternalMapUrl()} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      >
                          <ExternalLink className="w-3 h-3" />
                          Open Full Map in Google Maps
                      </a>
                  )}
              </div>
              <div className="flex-1 bg-gray-100 dark:bg-gray-900 relative">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no" 
                    marginHeight={0} 
                    marginWidth={0} 
                    src={getMapEmbedUrl()}
                    className="w-full h-full absolute inset-0"
                    title="Live Trip Map"
                  />
              </div>
              <div className="p-2 bg-white dark:bg-gray-800 text-xs text-center text-gray-400 border-t border-gray-100 dark:border-gray-700">
                  {mapViewMode === 'overview' 
                    ? 'Showing destination area' 
                    : mapViewMode === 'all-days' 
                        ? 'Showing route of all planned activities' 
                        : 'Showing driving route between planned locations'}
              </div>
           </aside>
        )}
      </div>
    </div>
  );
};

export default App;