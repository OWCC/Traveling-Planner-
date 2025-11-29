import React, { useState, useEffect } from 'react';
import { Trip, Expense, CURRENCY_SYMBOLS } from '../types';
import { Card, Button, ProgressBar } from './UIComponents';
import { Calendar, MapPin, Wallet, ArrowRight, Sun, Cloud, Plus, LayoutDashboard, Plane, CloudRain, Wind, Settings, ArrowUp, ArrowDown, Eye, EyeOff, Download } from 'lucide-react';

interface DashboardProps {
    trip: Trip | null;
    activeTripId: string | null;
    expenses: Expense[];
    savedTrips: { id: string, name: string, lastUpdated: string }[];
    onLoadTrip: (id: string) => void;
    onCreateTrip: () => void;
    currency: string;
    onNavigate: (tab: 'planner' | 'expenses') => void;
    onExportTrip: () => void;
}

interface DashboardSettings {
    showWeather: boolean;
    showBudget: boolean;
    showRecentTrips: boolean;
    sidebarOrder: ('budget' | 'recentTrips')[];
}

const DEFAULT_SETTINGS: DashboardSettings = {
    showWeather: true,
    showBudget: true,
    showRecentTrips: true,
    sidebarOrder: ['budget', 'recentTrips']
};

export const Dashboard: React.FC<DashboardProps> = ({
    trip,
    activeTripId,
    expenses,
    savedTrips,
    onLoadTrip,
    onCreateTrip,
    currency,
    onNavigate,
    onExportTrip
}) => {
    const symbol = CURRENCY_SYMBOLS[currency] || '$';
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    
    // Customization State
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);

    // Load settings on mount
    useEffect(() => {
        const saved = localStorage.getItem('wanderlust_dashboard_settings');
        if (saved) {
            try {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Failed to parse dashboard settings", e);
            }
        }
    }, []);

    const updateSettings = (newSettings: DashboardSettings) => {
        setSettings(newSettings);
        localStorage.setItem('wanderlust_dashboard_settings', JSON.stringify(newSettings));
    };

    const toggleWidget = (key: keyof DashboardSettings) => {
        if (key === 'sidebarOrder') return;
        updateSettings({ ...settings, [key]: !settings[key] });
    };

    const moveWidget = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...settings.sidebarOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        updateSettings({ ...settings, sidebarOrder: newOrder });
    };

    const getGreeting = () => {
        const hour = today.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    // Calculate Financials
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const budget = trip?.targetBudget || 0;
    const remaining = Math.max(0, budget - totalSpent);
    const isOverBudget = budget > 0 && totalSpent > budget;

    // Extract basic weather from insights if available
    const getWeatherSnippet = () => {
        if (!trip?.insights?.content) return null;
        const weatherSection = trip.insights.content.split('##').find(s => s.toLowerCase().includes('weather'));
        if (!weatherSection) return null;
        
        // Grab the first bullet point
        const lines = weatherSection.split('\n').filter(l => l.trim().startsWith('*') || l.trim().startsWith('-'));
        if (lines.length > 0) {
            return lines[0].replace(/[\*\-]/, '').trim();
        }
        return null;
    };

    const weatherSnippet = getWeatherSnippet();
    const isSidebarVisible = settings.showBudget || settings.showRecentTrips;

    // Render Helpers for draggable widgets
    const renderBudgetCard = () => (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-secondary" />
                    Trip Budget
                </h3>
                {budget > 0 && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isOverBudget ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {isOverBudget ? 'Over Budget' : 'On Track'}
                    </span>
                )}
            </div>
            
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500 dark:text-gray-400">Total Spent</span>
                        <span className="font-bold text-gray-900 dark:text-white">{symbol}{totalSpent.toFixed(2)}</span>
                    </div>
                    {budget > 0 && (
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-500 dark:text-gray-400">Budget</span>
                            <span className="font-medium text-gray-900 dark:text-white">{symbol}{budget.toFixed(2)}</span>
                        </div>
                    )}
                    {budget > 0 ? (
                        <ProgressBar 
                            value={totalSpent} 
                            max={budget} 
                            colorClass={isOverBudget ? 'bg-red-500' : 'bg-secondary'}
                        />
                    ) : (
                        <div className="text-xs text-gray-400 mt-2">Set a target budget in "Plan" to track progress.</div>
                    )}
                </div>
                <Button 
                    onClick={() => onNavigate('expenses')} 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-primary hover:text-primary hover:bg-teal-50 dark:hover:bg-teal-900/20"
                >
                    Add Expense <Plus className="w-4 h-4 ml-1" />
                </Button>
            </div>
        </Card>
    );

    const renderRecentTripsCard = () => (
        <Card className="p-6 flex-1">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Switch Trip</h3>
                <Button size="sm" variant="ghost" onClick={onCreateTrip} className="h-6 w-6 p-0 rounded-full bg-gray-100 dark:bg-gray-700">
                    <Plus className="w-3 h-3" />
                </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {savedTrips.slice(0, 5).map(t => (
                    <div 
                        key={t.id}
                        onClick={() => onLoadTrip(t.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between group ${activeTripId === t.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'}`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeTripId === t.id ? 'bg-primary' : 'bg-gray-300'}`}></div>
                            <div className="truncate">
                                <div className={`text-sm font-medium truncate ${activeTripId === t.id ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>{t.name}</div>
                                <div className="text-[10px] text-gray-400">Last updated: {new Date(t.lastUpdated).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>
                ))}
                {savedTrips.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-2">No saved trips found</div>
                )}
            </div>
        </Card>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getGreeting()}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formattedDate}
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Settings / Customize Button */}
                    {trip && (
                    <>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={onExportTrip}
                            className="text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Export Trip JSON"
                        >
                             <Download className="w-4 h-4 mr-2" />
                             Export
                        </Button>

                        <div className="relative">
                            <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800">
                                <Settings className="w-4 h-4 mr-2" />
                                Customize
                            </Button>
                            
                            {showSettings && (
                                <Card className="absolute right-0 top-12 w-72 z-50 p-4 shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 bg-white dark:bg-gray-800">
                                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">Customize Layout</h4>
                                        <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">Close</button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Visibility</p>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">Weather Widget</span>
                                                    <button onClick={() => toggleWidget('showWeather')} className="text-gray-500 hover:text-primary">
                                                        {settings.showWeather ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-gray-300" />}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">Trip Budget</span>
                                                    <button onClick={() => toggleWidget('showBudget')} className="text-gray-500 hover:text-primary">
                                                        {settings.showBudget ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-gray-300" />}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">Recent Trips</span>
                                                    <button onClick={() => toggleWidget('showRecentTrips')} className="text-gray-500 hover:text-primary">
                                                        {settings.showRecentTrips ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-gray-300" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Sidebar Order</p>
                                            <div className="space-y-1">
                                                {settings.sidebarOrder.map((item, index) => (
                                                    <div key={item} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                                                        <span className="text-gray-700 dark:text-gray-300 capitalize">{item === 'recentTrips' ? 'Recent Trips' : item}</span>
                                                        <div className="flex gap-1">
                                                            <button 
                                                                disabled={index === 0}
                                                                onClick={() => moveWidget(index, 'up')}
                                                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                                                            >
                                                                <ArrowUp className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                disabled={index === settings.sidebarOrder.length - 1}
                                                                onClick={() => moveWidget(index, 'down')}
                                                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                                                            >
                                                                <ArrowDown className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </>
                    )}

                    {!trip && (
                        <Button onClick={onCreateTrip} className="shadow-lg shadow-primary/20">
                            <Plus className="w-4 h-4 mr-2" />
                            Start New Journey
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Active Trip Card */}
            {trip ? (
                <div className={`grid grid-cols-1 ${isSidebarVisible ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6 transition-all`}>
                    {/* Destination & Status */}
                    <Card className={`${isSidebarVisible ? 'lg:col-span-2' : 'lg:col-span-1'} relative min-h-[280px] flex flex-col justify-end group overflow-hidden border-0 transition-all`}>
                        <div className="absolute inset-0">
                             <img 
                                src={`https://picsum.photos/800/600?random=${trip.destination}`} 
                                alt={trip.destination}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10"></div>
                        </div>
                        <div className="relative z-10 p-6 sm:p-8 text-white">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold border border-white/30 mb-2">
                                        Current Trip
                                    </span>
                                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{trip.destination}</h2>
                                </div>
                                {settings.showWeather && weatherSnippet && (
                                    <div className="hidden sm:block bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 max-w-xs animate-in fade-in zoom-in-95">
                                        <div className="flex items-center gap-2 mb-1 text-sky-300 font-bold text-sm">
                                            <Cloud className="w-4 h-4" />
                                            Forecast
                                        </div>
                                        <p className="text-xs text-gray-100 line-clamp-2">{weatherSnippet}</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-200 mb-6">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    {trip.duration} Days
                                </div>
                                <div className="w-px h-4 bg-gray-500/50"></div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-secondary" />
                                    {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : 'Date TBD'}
                                </div>
                                {trip.travelerCount > 1 && (
                                    <>
                                     <div className="w-px h-4 bg-gray-500/50"></div>
                                     <div>{trip.travelerCount} Travelers</div>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <Button 
                                    onClick={() => onNavigate('planner')} 
                                    variant="outline"
                                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white backdrop-blur-sm"
                                >
                                    View Itinerary
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                                <Button 
                                    onClick={() => onNavigate('expenses')} 
                                    variant="outline" 
                                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white backdrop-blur-sm"
                                >
                                    Manage Wallet
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {/* Quick Stats Column */}
                    {isSidebarVisible && (
                        <div className="space-y-6">
                            {settings.sidebarOrder.map(item => {
                                if (item === 'budget' && settings.showBudget) return <React.Fragment key="budget">{renderBudgetCard()}</React.Fragment>;
                                if (item === 'recentTrips' && settings.showRecentTrips) return <React.Fragment key="recent">{renderRecentTripsCard()}</React.Fragment>;
                                return null;
                            })}
                        </div>
                    )}
                </div>
            ) : (
                // Empty State / Initial Dashboard
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="col-span-full py-16 px-6 text-center bg-gradient-to-br from-teal-50 to-white dark:from-gray-800 dark:to-gray-900 border-dashed border-2 border-gray-200 dark:border-gray-700">
                        <div className="mx-auto w-16 h-16 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-sm mb-4">
                            <Plane className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ready for your next adventure?</h2>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
                            Plan detailed itineraries, track flights, and manage shared expenses all in one place.
                        </p>
                        <Button size="lg" onClick={onCreateTrip} className="shadow-xl shadow-primary/20">
                            <Plus className="w-5 h-5 mr-2" />
                            Plan a New Trip
                        </Button>
                    </Card>

                    <div className="col-span-full">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-1">Recent Trips</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {savedTrips.slice(0, 4).map(t => (
                                <Card 
                                    key={t.id} 
                                    className="p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
                                >
                                    <div onClick={() => onLoadTrip(t.id)}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                <MapPin className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-full">
                                                {new Date(t.lastUpdated).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-gray-900 dark:text-white truncate mb-1">{t.name}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Click to resume</p>
                                    </div>
                                </Card>
                            ))}
                            {savedTrips.length === 0 && (
                                <div className="col-span-full text-center py-8 text-gray-400 text-sm">
                                    Your trip history is empty.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};