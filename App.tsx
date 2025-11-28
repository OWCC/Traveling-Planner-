
import React, { useState, useEffect } from 'react';
import { Plane, Wallet, Users, LayoutDashboard, Save, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { TripPlanner } from './components/TripPlanner';
import { ExpenseTracker } from './components/ExpenseTracker';
import { Traveler, Trip, TripData, Expense, ExpenseFolder } from './types';
import { Button, Card, Input } from './components/UIComponents';

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
  const [activeTab, setActiveTab] = useState<'planner' | 'expenses' | 'settings'>('planner');
  
  // App State - now bundled into a Project structure
  // We keep the "Active Trip Data" in state, and a list of "Saved Projects" in metadata
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
    
    // Initial Data Object
    const initialData: TripData = {
        id: newId,
        name: newName,
        lastUpdated: new Date().toISOString(),
        trip: null,
        travelers: INITIAL_TRAVELERS,
        expenses: [],
        expenseFolders: DEFAULT_FOLDERS,
        categories: DEFAULT_CATEGORIES,
        currency: DEFAULT_CURRENCY
    };

    // Save Data & Metadata immediately
    const newMeta = { id: newId, name: newName, lastUpdated: initialData.lastUpdated };
    const updatedList = [newMeta, ...savedTrips];
    setSavedTrips(updatedList);
    
    localStorage.setItem('wanderlust_projects', JSON.stringify(updatedList));
    localStorage.setItem(`wanderlust_data_${newId}`, JSON.stringify(initialData));
    localStorage.setItem('wanderlust_active_id', newId);
    
    setShowLoadMenu(false);
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

  return (
    <div className="min-h-screen bg-background text-gray-800 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-1.5 rounded-lg flex-shrink-0">
                <Plane className="h-5 w-5 text-white" />
              </div>
              <input 
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="font-bold text-lg tracking-tight text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none transition-colors w-24 sm:w-48 lg:w-auto"
              />
            </div>
            
            <nav className="flex space-x-1 bg-gray-100 p-1 rounded-xl mx-2 sm:mx-4">
              <button
                onClick={() => setActiveTab('planner')}
                className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'planner' 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Plan</span>
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'expenses' 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
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
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase">My Trips</span>
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
                                className={`px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center group ${activeTripId === trip.id ? 'bg-teal-50 border-l-4 border-primary' : ''}`}
                            >
                                <div>
                                    <div className="font-medium text-gray-800 text-sm">{trip.name}</div>
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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8">
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
      </main>
    </div>
  );
};

export default App;
