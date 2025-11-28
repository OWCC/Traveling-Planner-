
export interface Traveler {
  id: string;
  name: string;
}

export interface Activity {
  time: string;
  activity: string;
  location: string;
  description: string;
  estimatedCost?: string;
}

export interface DayPlan {
  day: number;
  theme: string;
  activities: Activity[];
}

export interface Flight {
  airline: string;
  flightNumber: string;
  departureTime: string;
  departureAirport: string;
  arrivalAirport: string;
  arrivalTime: string;
  price?: number;
  status?: string;
}

export interface TripInsights {
  content: string; // Markdown content with Weather, Safety, etc.
  sources: { title: string; uri: string }[]; // Grounding sources
  lastFetched: string;
}

export interface Trip {
  destination: string;
  duration: number;
  startDate?: string;
  itinerary: DayPlan[];
  budget?: string;
  targetBudget?: number;
  travelerCount: number;
  flights?: Flight[];
  insights?: TripInsights;
}

export interface ExpenseFolder {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  folderId?: string; // Links expense to a specific folder/activity
  description: string;
  amount: number;
  date: string;
  payerId: string;
  splitBetween: string[]; // IDs of travelers involved
  category: string;
}

export interface Settlement {
  fromId: string;
  toId: string;
  amount: number;
}

// The Unified Container for a saved "File" or "Project"
export interface TripData {
  id: string;
  name: string;
  lastUpdated: string;
  trip: Trip | null;
  travelers: Traveler[];
  expenses: Expense[];
  expenseFolders: ExpenseFolder[];
  categories?: string[];
  currency?: string;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CNY: '¥',
  INR: '₹',
  SGD: 'S$',
  KRW: '₩',
  MXN: 'Mex$',
  CHF: 'Fr'
};
