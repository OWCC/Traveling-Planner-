import React, { useState, useMemo, useEffect } from 'react';
import { MapPin, Calendar as CalendarIcon, Sparkles, Map, Edit2, Save, X, Trash2, FileText, Mail, Plane, Plus, Link, CheckCircle, LogOut, ShieldAlert, CloudSun, Info, ExternalLink, RefreshCw, Image as ImageIcon, Navigation, Lightbulb, DollarSign, Map as MapIcon } from 'lucide-react';
import { generateItinerary, parseFlightEmail, generateTripInsights } from '../services/geminiService';
import { Trip, DayPlan, Activity, Flight, CURRENCY_SYMBOLS } from '../types';
import { Button, Input, Card } from './UIComponents';

interface TripPlannerProps {
  trip: Trip | null;
  onSaveTrip: (trip: Trip) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
}

export const TripPlanner: React.FC<TripPlannerProps> = ({ trip, onSaveTrip, currency, onCurrencyChange }) => {
  const [loading, setLoading] = useState(false);
  const [flightLoading, setFlightLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [isGmailLinked, setIsGmailLinked] = useState(false);
  
  const symbol = CURRENCY_SYMBOLS[currency] || '$';

  // Default dates: Today and 3 days from now
  const today = new Date().toISOString().split('T')[0];
  const threeDaysLater = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    destination: '',
    startDate: today,
    endDate: threeDaysLater,
    budget: 'Moderate',
    targetBudget: '',
    interests: 'Food, History, Nature',
    notes: '',
    flightNumber: '',
    returnFlightNumber: ''
  });

  // Sync formData with trip prop when it changes (i.e. on load)
  useEffect(() => {
    if (trip) {
      const start = trip.startDate || today;
      // Calculate derived end date if possible, otherwise keep current or default
      let end = formData.endDate;
      if (trip.duration) {
         end = new Date(new Date(start).getTime() + ((trip.duration - 1) * 86400000)).toISOString().split('T')[0];
      }

      setFormData(prev => ({
        ...prev,
        destination: trip.destination,
        startDate: start,
        endDate: end,
        budget: trip.budget || prev.budget,
        targetBudget: trip.targetBudget ? trip.targetBudget.toString() : '',
      }));
    }
  }, [trip]);

  const [emailText, setEmailText] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Flight Edit State
  const [isFlightFormOpen, setIsFlightFormOpen] = useState(false);
  const [editingFlightIndex, setEditingFlightIndex] = useState<number | null>(null);
  const emptyFlight: Flight = {
    airline: '',
    flightNumber: '',
    departureAirport: '',
    arrivalAirport: '',
    departureTime: '',
    arrivalTime: '',
    price: 0,
    status: 'Scheduled'
  };
  const [tempFlight, setTempFlight] = useState<Flight>(emptyFlight);

  // Calculate duration derived from dates
  const duration = useMemo(() => {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = end.getTime() - start.getTime();
    // Difference in days + 1 (inclusive)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  }, [formData.startDate, formData.endDate]);

  // Granular Edit State
  const [editingCell, setEditingCell] = useState<{dayIndex: number, actIndex: number} | null>(null);
  const [tempActivity, setTempActivity] = useState<Activity | null>(null);

  // Map State
  const [showMap, setShowMap] = useState(false);
  const [activeDayMap, setActiveDayMap] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!formData.destination) return;
    
    setLoading(true);
    setEditingCell(null);
    try {
      const budgetText = formData.targetBudget ? `${formData.budget} (Approx. ${currency} ${formData.targetBudget})` : formData.budget;
      const promptContext = `${formData.interests}. ${formData.notes ? `Additional preferences: ${formData.notes}` : ''}. Currency: ${currency}.`;
      
      const generatedTrip = await generateItinerary(
        formData.destination,
        duration,
        promptContext,
        budgetText
      );

      const initialFlights: Flight[] = [];
      
      if (formData.flightNumber) {
          initialFlights.push({
            airline: 'Outbound',
            flightNumber: formData.flightNumber,
            departureAirport: 'Origin',
            arrivalAirport: formData.destination.split(',')[0],
            departureTime: formData.startDate,
            arrivalTime: 'TBD',
            price: 0,
            status: 'Scheduled'
        });
      }

      if (formData.returnFlightNumber) {
          initialFlights.push({
            airline: 'Return',
            flightNumber: formData.returnFlightNumber,
            departureAirport: formData.destination.split(',')[0],
            arrivalAirport: 'Origin',
            departureTime: formData.endDate,
            arrivalTime: 'TBD',
            price: 0,
            status: 'Scheduled'
        });
      }

      // Automatically fetch insights after generation
      let insights = undefined;
      try {
        insights = await generateTripInsights(formData.destination, formData.startDate);
      } catch (e) {
        console.warn("Could not auto-fetch insights", e);
      }

      // Inject the selected start date into the trip object
      onSaveTrip({ 
          ...generatedTrip, 
          startDate: formData.startDate, 
          flights: initialFlights,
          insights: insights,
          targetBudget: formData.targetBudget ? Number(formData.targetBudget) : undefined
      });
    } catch (error) {
      alert("Failed to generate itinerary. Please ensure your API Key is valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchInsights = async () => {
      if (!trip) return;
      setInsightsLoading(true);
      try {
          const insights = await generateTripInsights(trip.destination, trip.startDate || today);
          onSaveTrip({ ...trip, insights });
      } catch (e) {
          alert("Failed to update insights.");
      } finally {
          setInsightsLoading(false);
      }
  };

  const handleManualCreate = () => {
    if (!formData.destination) return;
    
    setEditingCell(null);
    // Create empty days based on calculated duration
    const newItinerary: DayPlan[] = Array.from({ length: duration }, (_, i) => ({
        day: i + 1,
        theme: 'Free Day',
        activities: []
    }));

    const initialFlights: Flight[] = [];
      
    if (formData.flightNumber) {
        initialFlights.push({
        airline: 'Outbound',
        flightNumber: formData.flightNumber,
        departureAirport: 'Origin',
        arrivalAirport: formData.destination.split(',')[0],
        departureTime: formData.startDate,
        arrivalTime: 'TBD',
        price: 0,
        status: 'Scheduled'
    });
    }

    if (formData.returnFlightNumber) {
        initialFlights.push({
        airline: 'Return',
        flightNumber: formData.returnFlightNumber,
        departureAirport: formData.destination.split(',')[0],
        arrivalAirport: 'Origin',
        departureTime: formData.endDate,
        arrivalTime: 'TBD',
        price: 0,
        status: 'Scheduled'
    });
    }

    const newTrip: Trip = {
        destination: formData.destination,
        duration: duration,
        startDate: formData.startDate,
        budget: formData.budget,
        targetBudget: formData.targetBudget ? Number(formData.targetBudget) : undefined,
        travelerCount: 1,
        itinerary: newItinerary,
        flights: initialFlights
    };
    
    onSaveTrip(newTrip);
  };

  const handleLinkGmail = () => {
      setFlightLoading(true);
      setTimeout(() => {
          setIsGmailLinked(true);
          setFlightLoading(false);
      }, 1500);
  };

  const handleUnlinkGmail = () => {
      setIsGmailLinked(false);
      alert("Gmail account disconnected.");
  };

  const handleGmailSync = async () => {
    setFlightLoading(true);
    // Simulation of Google Gmail API Sync
    setTimeout(() => {
        const mockFlights: Flight[] = [
            {
                airline: 'United Airlines',
                flightNumber: 'UA 123',
                departureAirport: 'SFO',
                arrivalAirport: 'NRT',
                departureTime: '10:00 AM',
                arrivalTime: '02:00 PM (+1)',
                price: 1200,
                status: 'On Time'
            },
            {
                airline: 'United Airlines',
                flightNumber: 'UA 456',
                departureAirport: 'NRT',
                arrivalAirport: 'SFO',
                departureTime: '04:00 PM',
                arrivalTime: '09:00 AM (+1)',
                price: 1100,
                status: 'Scheduled'
            }
        ];
        
        if (trip) {
            onSaveTrip({
                ...trip,
                flights: [...(trip.flights || []), ...mockFlights]
            });
        }
        setFlightLoading(false);
        alert("Synced 2 flights from Gmail!");
    }, 2000);
  };

  const handleParseEmail = async () => {
      if(!emailText) return;
      setFlightLoading(true);
      try {
          const flightData = await parseFlightEmail(emailText);
          // Add default status for parsed flights
          const flightWithStatus = { ...flightData, status: 'Scheduled' };
          
          if (trip) {
              onSaveTrip({
                  ...trip,
                  flights: [...(trip.flights || []), flightWithStatus]
              });
          } else {
             alert("Please create a trip first before adding flights.");
          }
          setEmailText('');
          setShowEmailInput(false);
      } catch (e) {
          alert("Could not extract flight info. Please try again.");
      } finally {
          setFlightLoading(false);
      }
  };

  const deleteFlight = (index: number) => {
      if(!trip || !trip.flights) return;
      const newFlights = trip.flights.filter((_, i) => i !== index);
      onSaveTrip({...trip, flights: newFlights});
  };

  const openFlightForm = (flight?: Flight, index?: number) => {
      if (flight && index !== undefined) {
          setTempFlight(flight);
          setEditingFlightIndex(index);
      } else {
          setTempFlight(emptyFlight);
          setEditingFlightIndex(null);
      }
      setIsFlightFormOpen(true);
  };

  const cancelFlightEdit = () => {
    setIsFlightFormOpen(false);
    setTempFlight(emptyFlight);
    setEditingFlightIndex(null);
  };

  const saveFlight = () => {
      if (!trip) return;
      
      const newFlights = [...(trip.flights || [])];
      if (editingFlightIndex !== null) {
          newFlights[editingFlightIndex] = tempFlight;
      } else {
          newFlights.push(tempFlight);
      }
      
      onSaveTrip({ ...trip, flights: newFlights });
      cancelFlightEdit();
  };

  const startEditingActivity = (dayIndex: number, actIndex: number, activity: Activity) => {
    setEditingCell({ dayIndex, actIndex });
    setTempActivity({ ...activity });
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setTempActivity(null);
  };

  const saveActivity = () => {
    if (!trip || !editingCell || !tempActivity) return;
    
    const newItinerary = [...trip.itinerary];
    const dayIndex = editingCell.dayIndex;
    
    // Create a new day object and activity array to avoid mutation
    const updatedDay = {
        ...newItinerary[dayIndex],
        activities: [...newItinerary[dayIndex].activities]
    };
    
    updatedDay.activities[editingCell.actIndex] = tempActivity;
    newItinerary[dayIndex] = updatedDay;
    
    onSaveTrip({
        ...trip,
        itinerary: newItinerary
    });
    
    setEditingCell(null);
    setTempActivity(null);
  };

  const updateTempActivity = (field: keyof Activity, value: string) => {
    if (tempActivity) {
      setTempActivity({ ...tempActivity, [field]: value });
    }
  };

  const addActivity = (dayIndex: number) => {
    if (!trip) return;
    
    const newActivity: Activity = {
        time: '09:00',
        activity: 'New Activity',
        location: 'Location',
        description: 'Add details here',
        estimatedCost: ''
    };

    const newItinerary = [...trip.itinerary];
    const updatedDay = {
        ...newItinerary[dayIndex],
        activities: [...newItinerary[dayIndex].activities, newActivity]
    };
    newItinerary[dayIndex] = updatedDay;
    
    const newTrip = { ...trip, itinerary: newItinerary };
    onSaveTrip(newTrip);

    // Automatically enter edit mode for the new activity
    startEditingActivity(dayIndex, updatedDay.activities.length - 1, newActivity);
  };

  const removeActivity = (dayIndex: number, actIndex: number) => {
    if (!trip) return;
    
    // If we are editing this exact item, cancel edit mode
    if (editingCell?.dayIndex === dayIndex && editingCell?.actIndex === actIndex) {
        cancelEditing();
    }

    const newItinerary = [...trip.itinerary];
    const updatedDay = {
        ...newItinerary[dayIndex],
        activities: newItinerary[dayIndex].activities.filter((_, idx) => idx !== actIndex)
    };
    newItinerary[dayIndex] = updatedDay;
    
    onSaveTrip({
        ...trip,
        itinerary: newItinerary
    });
  };

  const getDateForDay = (start: string | undefined, dayOffset: number) => {
    if (!start) return null;
    const date = new Date(start);
    date.setDate(date.getDate() + dayOffset);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('delay')) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800';
    if (s.includes('cancel')) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800';
    return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800';
  };

  const getDirectionLink = (activities: Activity[]) => {
      const locations = activities
        .map(a => a.location)
        .filter(l => l && l !== 'Location' && l.trim() !== '')
        .map(l => encodeURIComponent(l));
      
      if (locations.length < 2) return '#';
      
      const origin = locations[0];
      const destination = locations[locations.length - 1];
      const waypoints = locations.slice(1, -1).join('|');
      
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  };

  const getEmbedRouteUrl = (activities: Activity[]) => {
    const locations = activities
        .map(a => a.location)
        .filter(l => l && l !== 'Location' && l.trim() !== '')
        .map(l => encodeURIComponent(l));
    
    if (locations.length === 0) return null;
    
    // If only one location, just show that location
    if (locations.length === 1) {
        return `https://maps.google.com/maps?q=${locations[0]}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
    }

    // Construct query: from:Origin to:Waypoint1 to:Waypoint2 to:Dest
    const origin = locations[0];
    const dest = locations[locations.length - 1];
    const waypoints = locations.slice(1, -1);
    
    let query = `from:${origin}`;
    waypoints.forEach(wp => query += `+to:${wp}`);
    query += `+to:${dest}`;

    return `https://maps.google.com/maps?q=${query}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Input Section */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="text-secondary w-5 h-5" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Plan New Trip</h2>
          </div>
          
          <div className="space-y-4">
            <Input 
              label="Where to?" 
              placeholder="e.g. Kyoto, Japan" 
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Outbound Flight (Optional)" 
                  placeholder="e.g. UA 123" 
                  value={formData.flightNumber}
                  onChange={(e) => setFormData({...formData, flightNumber: e.target.value})}
                />
                <Input 
                  label="Return Flight (Optional)" 
                  placeholder="e.g. UA 456" 
                  value={formData.returnFlightNumber}
                  onChange={(e) => setFormData({...formData, returnFlightNumber: e.target.value})}
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm placeholder-gray-400"
                    value={formData.startDate}
                    onChange={(e) => {
                        const newStart = e.target.value;
                        let newEnd = formData.endDate;
                        if (newStart > newEnd) newEnd = newStart;
                        setFormData({...formData, startDate: newStart, endDate: newEnd});
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm placeholder-gray-400"
                    value={formData.endDate}
                    min={formData.startDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="text-right">
                <span className="text-xs font-medium text-primary bg-primary/10 dark:bg-primary/20 px-2 py-1 rounded">
                    Duration: {duration} Days
                </span>
            </div>

            {/* Currency Selector */}
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
               <select
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  value={currency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                >
                  {Object.keys(CURRENCY_SYMBOLS).map(code => (
                    <option key={code} value={code}>{code} ({CURRENCY_SYMBOLS[code]})</option>
                  ))}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget Style</label>
                  <select 
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: e.target.value})}
                  >
                    <option>Budget</option>
                    <option>Moderate</option>
                    <option>Luxury</option>
                  </select>
                </div>
                <div>
                   <Input 
                      label={`Target Budget (${symbol})`}
                      type="number"
                      placeholder="e.g. 2000"
                      value={formData.targetBudget}
                      onChange={(e) => setFormData({...formData, targetBudget: e.target.value})}
                    />
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interests (for AI)</label>
              <textarea 
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none placeholder-gray-400"
                rows={3}
                value={formData.interests}
                onChange={(e) => setFormData({...formData, interests: e.target.value})}
                placeholder="e.g. Food, History, Nature"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Additional Notes</label>
              <textarea 
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none placeholder-gray-400"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="e.g. Prefer walking tours, vegan food options, early starts..."
              />
            </div>

            <div className="flex flex-col gap-3 mt-4">
                <Button 
                    onClick={handleGenerate}
                    isLoading={loading}
                    disabled={!formData.destination}
                    className="w-full"
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {loading ? 'Generating...' : 'AI Auto-Generate'}
                </Button>

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-medium">Or</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                </div>

                <Button 
                    variant="outline"
                    onClick={handleManualCreate}
                    disabled={!formData.destination}
                    className="w-full"
                >
                    <FileText className="w-4 h-4 mr-2" />
                    Start from Scratch
                </Button>
            </div>
          </div>
        </Card>

        {/* Flight Sync Section */}
        {trip && (
            <Card className="p-4 sm:p-6 sticky top-24">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Plane className="text-secondary w-5 h-5" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Flight Tracking</h2>
                    </div>
                </div>
                
                {isFlightFormOpen ? (
                     <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">{editingFlightIndex !== null ? 'Edit Flight' : 'Add Flight'}</h4>
                             <button onClick={cancelFlightEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-4 h-4"/></button>
                        </div>
                        <input 
                            placeholder="Airline (e.g. United)"
                            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded text-sm"
                            value={tempFlight.airline}
                            onChange={e => setTempFlight({...tempFlight, airline: e.target.value})}
                        />
                        <input 
                            placeholder="Flight Number (e.g. UA 123)"
                            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded text-sm"
                            value={tempFlight.flightNumber}
                            onChange={e => setTempFlight({...tempFlight, flightNumber: e.target.value})}
                        />
                         <div className="grid grid-cols-2 gap-2">
                            <input 
                                placeholder="Dep Airport"
                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded text-sm"
                                value={tempFlight.departureAirport}
                                onChange={e => setTempFlight({...tempFlight, departureAirport: e.target.value})}
                            />
                            <input 
                                placeholder="Arr Airport"
                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded text-sm"
                                value={tempFlight.arrivalAirport}
                                onChange={e => setTempFlight({...tempFlight, arrivalAirport: e.target.value})}
                            />
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                            <input 
                                placeholder="Dep Time"
                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded text-sm"
                                value={tempFlight.departureTime}
                                onChange={e => setTempFlight({...tempFlight, departureTime: e.target.value})}
                            />
                            <input 
                                placeholder="Arr Time"
                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded text-sm"
                                value={tempFlight.arrivalTime}
                                onChange={e => setTempFlight({...tempFlight, arrivalTime: e.target.value})}
                            />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="ghost" onClick={cancelFlightEdit} className="flex-1">Cancel</Button>
                            <Button size="sm" onClick={saveFlight} className="flex-1">Save Flight</Button>
                        </div>
                     </div>
                ) : (
                    <>
                        {!isGmailLinked ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Link your Google account to automatically find and track flights from your Gmail.
                                </p>
                                <Button 
                                    variant="outline" 
                                    onClick={handleLinkGmail}
                                    isLoading={flightLoading}
                                    className="w-full border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <Link className="w-4 h-4 mr-2" />
                                    Connect Google Account
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/30 p-2 rounded border border-green-100 dark:border-green-800">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-green-100 dark:bg-green-800 p-1 rounded-full">
                                            <Mail className="w-3 h-3 text-green-600 dark:text-green-300" />
                                        </div>
                                        <span className="text-xs font-medium text-green-800 dark:text-green-200">Gmail Connected</span>
                                    </div>
                                    <button onClick={handleUnlinkGmail} className="text-xs text-gray-400 hover:text-red-500">
                                        <LogOut className="w-3 h-3" />
                                    </button>
                                </div>

                                <Button 
                                    onClick={handleGmailSync}
                                    isLoading={flightLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Scan Inbox for Flights
                                </Button>
                            </div>
                        )}

                        <div className="relative flex items-center py-4">
                            <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-medium">Or</span>
                            <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                        </div>

                        <div className="space-y-2">
                            <Button 
                                variant="outline"
                                size="sm" 
                                onClick={() => openFlightForm()}
                                className="w-full text-xs"
                            >
                                <Plus className="w-3 h-3 mr-2" />
                                Add Flight Manually
                            </Button>

                            {!showEmailInput ? (
                                <button 
                                    onClick={() => setShowEmailInput(true)}
                                    className="w-full text-xs text-center text-gray-500 hover:text-primary pt-2"
                                >
                                    Paste email text...
                                </button>
                            ) : (
                                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                     <textarea 
                                        className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                                        rows={3}
                                        placeholder="Paste flight confirmation text here..."
                                        value={emailText}
                                        onChange={(e) => setEmailText(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="secondary" 
                                            size="sm"
                                            onClick={handleParseEmail}
                                            disabled={!emailText}
                                            isLoading={flightLoading}
                                            className="w-full text-xs"
                                        >
                                            Parse
                                        </Button>
                                        <Button 
                                            variant="ghost"
                                            size="sm" 
                                            onClick={() => setShowEmailInput(false)}
                                            className="text-xs"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </Card>
        )}
      </div>

      {/* Itinerary & Insights Display */}
      <div className="lg:col-span-2">
        {!trip && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <Map className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-white">No trip planned yet</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mt-2">
              Enter your destination and dates on the left to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Image & Map */}
            {trip && (
            <div className="relative h-48 rounded-2xl overflow-hidden shadow-md group bg-gray-200 dark:bg-gray-700">
              {showMap ? (
                  <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no" 
                    marginHeight={0} 
                    marginWidth={0} 
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(trip.destination)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                    className="w-full h-full"
                    title="Destination Map"
                  />
              ) : (
                  <img 
                    src={`https://picsum.photos/800/400?random=${trip.destination}`} 
                    alt={trip.destination}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
              )}
              
              <div className="absolute top-4 right-4 z-10">
                  <button 
                    onClick={() => setShowMap(!showMap)}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-2 rounded-lg shadow-sm hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-all text-xs font-bold flex items-center gap-2"
                  >
                      {showMap ? <ImageIcon className="w-4 h-4" /> : <Map className="w-4 h-4" />}
                      {showMap ? 'Photos' : 'Map'}
                  </button>
              </div>

              {!showMap && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end p-6 pointer-events-none">
                    <div className="text-white flex-1">
                      <h1 className="text-3xl font-bold">{trip.destination}</h1>
                      <p className="opacity-90 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {trip.startDate ? (
                            <>
                            {new Date(trip.startDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            {' - '}
                            {new Date(new Date(trip.startDate).getTime() + (trip.duration - 1) * 86400000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </>
                        ) : (
                            `${trip.duration} Days`
                        )}
                        <span className="mx-1">•</span>
                        {trip.targetBudget ? `${symbol}${trip.targetBudget} ` : ''} 
                        ({trip.budget || 'Custom'})
                      </p>
                    </div>
                  </div>
              )}
            </div>
            )}

            {/* Travel Insights / Safety / Weather */}
            {trip && (
                <Card className="p-0 overflow-hidden border-orange-100 dark:border-orange-900 shadow-sm">
                    <div className="bg-orange-50 dark:bg-orange-900/30 px-4 py-3 border-b border-orange-100 dark:border-orange-900 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Safety & Weather Insights</h3>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleFetchInsights}
                            isLoading={insightsLoading}
                            className="text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900 hover:text-orange-800 dark:hover:text-orange-200"
                        >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Update Live Info
                        </Button>
                    </div>
                    <div className="p-4 sm:p-6 bg-white dark:bg-gray-800">
                        {trip.insights ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {trip.insights.content.split('##').map((section, idx) => {
                                        if (!section.trim()) return null;
                                        const lines = section.trim().split('\n');
                                        const title = lines[0].trim();
                                        const contentLines = lines.slice(1).filter(l => l.trim().length > 0);
                                        
                                        // Skip empty sections
                                        if (contentLines.length === 0) return null;

                                        return (
                                            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                                                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                                    {title.includes('Weather') && <CloudSun className="w-5 h-5 text-blue-500" />}
                                                    {title.includes('Safety') && <ShieldAlert className="w-5 h-5 text-red-500" />}
                                                    {title.includes('Emergency') && <Info className="w-5 h-5 text-green-500" />}
                                                    {title.includes('Tips') && <Lightbulb className="w-5 h-5 text-amber-500" />}
                                                    {title.replace(/^#+\s*/, '')}
                                                </h4>
                                                <ul className="space-y-2">
                                                    {contentLines.map((line, liIdx) => {
                                                        const cleanLine = line.replace(/^[\*\-]\s*/, '').trim();
                                                        if (!cleanLine) return null;
                                                        return (
                                                            <li key={liIdx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                                                                <span className="leading-tight">{cleanLine}</span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {trip.insights.sources && trip.insights.sources.length > 0 && (
                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Sources</p>
                                        <div className="flex flex-wrap gap-2">
                                            {trip.insights.sources.map((source, idx) => (
                                                <a 
                                                    key={idx} 
                                                    href={source.uri} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"
                                                >
                                                    {source.title}
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                {insightsLoading ? (
                                    <span className="text-gray-500 dark:text-gray-400">Scanning safety advisories and forecast...</span>
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400">
                                        No active insights. Click "Update Live Info" to scan for safety and weather alerts.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Flights Section */}
            {trip?.flights && trip.flights.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Plane className="w-5 h-5 text-primary" />
                        Travel Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {trip.flights.map((flight, idx) => (
                            <Card key={idx} className="p-4 bg-white dark:bg-gray-800 border-l-4 border-l-blue-500 relative group hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">{flight.airline}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono font-bold text-gray-900 dark:text-white">{flight.flightNumber}</p>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(flight.status)}`}>
                                                {flight.status || 'On Time'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => openFlightForm(flight, idx)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button 
                                            onClick={() => deleteFlight(idx)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{flight.departureAirport}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{flight.departureTime}</div>
                                    </div>
                                    <div className="flex-1 flex flex-col items-center px-4">
                                        <div className="w-full h-px bg-gray-300 dark:bg-gray-600 relative">
                                            <Plane className="w-3 h-3 text-blue-500 absolute left-1/2 -top-1.5 -ml-1.5 transform rotate-90" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{flight.arrivalAirport}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{flight.arrivalTime}</div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-6">
              {trip?.itinerary?.map((day: DayPlan, dayIndex: number) => {
                const dayDate = trip.startDate ? getDateForDay(trip.startDate, dayIndex) : null;
                const routeLink = getDirectionLink(day.activities);
                const embedUrl = getEmbedRouteUrl(day.activities);
                const hasActivities = day.activities.length > 0;
                const isMapOpen = activeDayMap === dayIndex;

                return (
                <Card key={dayIndex} className="p-0 border-l-4 border-l-primary">
                  <div className="bg-gray-50 dark:bg-gray-700/30 px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-baseline gap-2">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Day {day.day}</h3>
                        {dayDate && (
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                                {dayDate}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                         <span className="text-sm font-medium px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/30 text-primary dark:text-teal-300 border border-teal-100 dark:border-teal-800 hidden sm:inline-block">
                          {day.theme}
                        </span>
                        
                        {hasActivities && routeLink !== '#' && (
                            <>
                                <a 
                                    href={routeLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-full transition-colors border border-blue-100 dark:border-blue-800"
                                    title="View planning direction on map"
                                >
                                    <Navigation className="w-3 h-3" />
                                    <span className="hidden sm:inline">Directions</span>
                                </a>
                                
                                <button
                                    onClick={() => setActiveDayMap(isMapOpen ? null : dayIndex)}
                                    className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors border ${
                                        isMapOpen 
                                          ? 'bg-blue-600 text-white border-blue-600' 
                                          : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-blue-100 dark:border-blue-800'
                                    }`}
                                >
                                    <MapIcon className="w-3 h-3" />
                                    <span className="hidden sm:inline">{isMapOpen ? 'Hide Map' : 'Show Map'}</span>
                                </button>
                            </>
                        )}

                        <Button size="sm" variant="ghost" onClick={() => addActivity(dayIndex)} className="h-8 w-8 p-0 rounded-full">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                  </div>
                  
                  {/* Route Map */}
                  {isMapOpen && embedUrl && (
                      <div className="h-64 w-full bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                          <iframe
                              width="100%"
                              height="100%"
                              frameBorder="0"
                              src={embedUrl}
                              title={`Route Map Day ${day.day}`}
                          />
                      </div>
                  )}
                  {isMapOpen && !embedUrl && hasActivities && (
                      <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700">
                          Not enough location data to generate a route map.
                      </div>
                  )}

                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {day.activities.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            No activities planned for this day yet.
                        </div>
                    )}
                    {day.activities.map((act, actIndex) => {
                      const isEditing = editingCell?.dayIndex === dayIndex && editingCell?.actIndex === actIndex;
                      
                      return (
                        <div key={actIndex} className={`p-4 sm:p-6 transition-colors ${isEditing ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} group`}>
                          {isEditing && tempActivity ? (
                              // Edit Mode: Inputs
                              <div className="flex flex-col gap-4">
                                  <div className="flex gap-2 sm:gap-4">
                                      <div className="w-24 sm:w-32">
                                          <label className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1 block">Time</label>
                                          <input 
                                              value={tempActivity.time}
                                              onChange={(e) => updateTempActivity('time', e.target.value)}
                                              className="w-full text-sm p-2 bg-gray-700 text-white border border-gray-600 rounded focus:ring-2 focus:ring-secondary focus:outline-none"
                                          />
                                      </div>
                                      <div className="flex-1">
                                           <label className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1 block">Activity</label>
                                          <input 
                                              value={tempActivity.activity}
                                              onChange={(e) => updateTempActivity('activity', e.target.value)}
                                              className="w-full text-sm font-semibold p-2 bg-gray-700 text-white border border-gray-600 rounded focus:ring-2 focus:ring-secondary focus:outline-none"
                                          />
                                      </div>
                                  </div>
                                  <div className="flex gap-2 sm:gap-4">
                                      <div className="flex-1">
                                           <label className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1 block">Location</label>
                                          <div className="relative">
                                              <MapPin className="w-3 h-3 absolute left-2.5 top-2.5 text-gray-400" />
                                              <input 
                                                  value={tempActivity.location}
                                                  onChange={(e) => updateTempActivity('location', e.target.value)}
                                                  className="w-full text-sm p-2 pl-8 bg-gray-700 text-white border border-gray-600 rounded focus:ring-2 focus:ring-secondary focus:outline-none"
                                              />
                                          </div>
                                      </div>
                                      <div className="w-1/3">
                                           <label className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1 block">Cost</label>
                                          <div className="relative">
                                              <span className="absolute left-2.5 top-2.5 text-gray-400 text-xs">{symbol}</span>
                                              <input 
                                                  value={tempActivity.estimatedCost}
                                                  onChange={(e) => updateTempActivity('estimatedCost', e.target.value)}
                                                  className="w-full text-sm p-2 pl-6 bg-gray-700 text-white border border-gray-600 rounded focus:ring-2 focus:ring-secondary focus:outline-none"
                                                  placeholder="0"
                                              />
                                          </div>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1 block">Description</label>
                                      <textarea 
                                          value={tempActivity.description}
                                          onChange={(e) => updateTempActivity('description', e.target.value)}
                                          rows={2}
                                          className="w-full text-sm p-2 bg-gray-700 text-white border border-gray-600 rounded focus:ring-2 focus:ring-secondary focus:outline-none"
                                      />
                                  </div>
                                  <div className="flex justify-end gap-2 pt-2">
                                      <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
                                      <Button size="sm" onClick={saveActivity}>Save Changes</Button>
                                  </div>
                              </div>
                          ) : (
                              // View Mode: Display
                              <div className="flex gap-2 sm:gap-4">
                                  <div className="w-16 sm:w-20 pt-1 flex-shrink-0">
                                      <span className="text-sm font-bold text-gray-900 dark:text-white block">{act.time}</span>
                                  </div>
                                  <div className="flex-grow space-y-1">
                                      <h4 className="font-bold text-gray-900 dark:text-white">{act.activity}</h4>
                                      <p className="text-gray-600 dark:text-gray-300 text-sm">{act.description}</p>
                                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1">
                                          <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 hover:text-primary transition-colors group/link"
                                          >
                                              <MapPin className="w-3 h-3 group-hover/link:text-primary" /> 
                                              <span className="group-hover/link:underline">{act.location}</span>
                                          </a>
                                          {act.estimatedCost && (
                                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                                                  {symbol} {act.estimatedCost}
                                              </span>
                                          )}
                                      </div>
                                  </div>
                                  <div className="flex-shrink-0 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                      <button 
                                          onClick={() => startEditingActivity(dayIndex, actIndex, act)}
                                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                          title="Edit"
                                      >
                                          <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button 
                                          onClick={() => removeActivity(dayIndex, actIndex)}
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                          title="Remove"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};