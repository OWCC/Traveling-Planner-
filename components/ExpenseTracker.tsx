import React, { useState, useRef, useMemo } from 'react';
import { Plus, Camera, Receipt, Trash2, TrendingUp, PieChart, Users, ArrowRight, Folder, FolderPlus, Check, X } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';
import { Traveler, Expense, Settlement, ExpenseFolder, CURRENCY_SYMBOLS } from '../types';
import { parseReceiptImage } from '../services/geminiService';
import { Button, Input, Card } from './UIComponents';

interface ExpenseTrackerProps {
  travelers: Traveler[];
  onUpdateTravelers: (t: Traveler[]) => void;
  expenses: Expense[];
  onUpdateExpenses: (e: Expense[]) => void;
  folders: ExpenseFolder[];
  onUpdateFolders: (f: ExpenseFolder[]) => void;
  categories: string[];
  onUpdateCategories: (c: string[]) => void;
  currency: string;
}

export const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({ 
    travelers, 
    onUpdateTravelers,
    expenses,
    onUpdateExpenses,
    folders,
    onUpdateFolders,
    categories,
    onUpdateCategories,
    currency
}) => {
  const [activeView, setActiveView] = useState<'list' | 'analytics' | 'settle'>('list');
  const [isAdding, setIsAdding] = useState(false);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const symbol = CURRENCY_SYMBOLS[currency] || '$';

  // Folder State
  const [activeFolderId, setActiveFolderId] = useState<string>('general');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [viewAllFolders, setViewAllFolders] = useState(false); // Toggle for analytics/settlement

  // Category State
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // New Expense Form State
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    category: categories[0] || 'Food',
    date: new Date().toISOString().split('T')[0],
    payerId: travelers[0]?.id || '',
    splitBetween: travelers.map(t => t.id)
  });

  const COLORS = ['#0f766e', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16', '#6366f1'];

  // Filter expenses based on active folder
  const filteredExpenses = useMemo(() => {
    if (viewAllFolders) return expenses;
    return expenses.filter(e => (e.folderId || 'general') === activeFolderId);
  }, [expenses, activeFolderId, viewAllFolders]);

  const handleCreateFolder = () => {
    if(!newFolderName) return;
    const newFolder: ExpenseFolder = {
        id: Date.now().toString(),
        name: newFolderName
    };
    onUpdateFolders([...folders, newFolder]);
    setActiveFolderId(newFolder.id);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleAddCategory = () => {
    if (newCategoryName && !categories.includes(newCategoryName)) {
        const updatedCategories = [...categories, newCategoryName];
        onUpdateCategories(updatedCategories);
        setNewExpense({...newExpense, category: newCategoryName});
        setNewCategoryName('');
        setIsCreatingCategory(false);
    }
  };

  const handleAddExpense = () => {
    if (!newExpense.description || !newExpense.amount) return;
    
    const expense: Expense = {
      id: Date.now().toString(),
      folderId: activeFolderId, // Assign to current folder
      description: newExpense.description,
      amount: Number(newExpense.amount),
      date: newExpense.date || new Date().toISOString().split('T')[0],
      payerId: newExpense.payerId || travelers[0].id,
      splitBetween: newExpense.splitBetween && newExpense.splitBetween.length > 0 
        ? newExpense.splitBetween 
        : travelers.map(t => t.id),
      category: newExpense.category || categories[0] || 'Other'
    };

    onUpdateExpenses([expense, ...expenses]);
    setIsAdding(false);
    setNewExpense({
      description: '',
      amount: 0,
      category: categories[0] || 'Food',
      date: new Date().toISOString().split('T')[0],
      payerId: travelers[0]?.id || '',
      splitBetween: travelers.map(t => t.id)
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingReceipt(true);
    setIsAdding(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        const extractedData = await parseReceiptImage(base64String);
        
        setNewExpense(prev => ({
          ...prev,
          ...extractedData,
          amount: extractedData.amount || 0,
          date: extractedData.date || new Date().toISOString().split('T')[0],
          // Keep existing category logic or default to first if invalid
          category: extractedData.category && categories.includes(extractedData.category) 
            ? extractedData.category 
            : categories[0]
        }));
      } catch (error) {
        alert("Could not read receipt automatically. Please enter details manually.");
      } finally {
        setProcessingReceipt(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const calculateSettlements = (): Settlement[] => {
    const balances: Record<string, number> = {};
    travelers.forEach(t => balances[t.id] = 0);

    // Use filteredExpenses if viewAllFolders is false, else use all expenses
    const expensesToCalculate = viewAllFolders ? expenses : filteredExpenses;

    expensesToCalculate.forEach(exp => {
      const paidBy = exp.payerId;
      const splitCount = exp.splitBetween.length;
      const amountPerPerson = exp.amount / splitCount;

      balances[paidBy] += exp.amount;
      exp.splitBetween.forEach(personId => {
        balances[personId] -= amountPerPerson;
      });
    });

    const debtors: {id: string, amount: number}[] = [];
    const creditors: {id: string, amount: number}[] = [];

    Object.entries(balances).forEach(([id, amount]) => {
      if (amount < -0.01) debtors.push({ id, amount });
      else if (amount > 0.01) creditors.push({ id, amount });
    });

    debtors.sort((a, b) => a.amount - b.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlements: Settlement[] = [];
    let i = 0; 
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(Math.abs(debtor.amount), creditor.amount);
      
      settlements.push({
        fromId: debtor.id,
        toId: creditor.id,
        amount: Number(amount.toFixed(2))
      });

      debtor.amount += amount;
      creditor.amount -= amount;

      if (Math.abs(debtor.amount) < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return settlements;
  };

  const getChartData = () => {
    const data: Record<string, number> = {};
    const expensesToChart = viewAllFolders ? expenses : filteredExpenses;
    
    expensesToChart.forEach(e => {
      data[e.category] = (data[e.category] || 0) + e.amount;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  };

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      {/* Folder Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {folders.map(folder => (
            <button
                key={folder.id}
                onClick={() => { setActiveFolderId(folder.id); setViewAllFolders(false); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeFolderId === folder.id && !viewAllFolders
                        ? 'bg-primary text-white shadow-md' 
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
                <Folder className="w-4 h-4" />
                {folder.name}
            </button>
        ))}
        
        {isCreatingFolder ? (
            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-left-4">
                <input 
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder Name"
                    className="px-3 py-1 bg-transparent text-sm focus:outline-none w-32 dark:text-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <button onClick={handleCreateFolder} className="p-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200">
                    <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setIsCreatingFolder(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <Plus className="w-3 h-3 rotate-45" />
                </button>
            </div>
        ) : (
            <button 
                onClick={() => setIsCreatingFolder(true)}
                className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium text-gray-500 hover:text-primary hover:bg-teal-50 dark:hover:bg-teal-900/30 border border-transparent border-dashed hover:border-teal-200 transition-all whitespace-nowrap"
            >
                <FolderPlus className="w-4 h-4" />
                New Folder
            </button>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800">
          <div>
            <p className="text-sm text-teal-600 dark:text-teal-400 font-medium">
                Total Spent {viewAllFolders ? '(All)' : `(${folders.find(f => f.id === activeFolderId)?.name})`}
            </p>
            <h3 className="text-2xl font-bold text-teal-900 dark:text-teal-100">{symbol}{totalSpent.toFixed(2)}</h3>
          </div>
          <TrendingUp className="text-teal-500 w-8 h-8" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Expenses Count</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{filteredExpenses.length}</h3>
          </div>
          <Receipt className="text-gray-400 w-8 h-8" />
        </Card>
        <div className="flex gap-2">
           <Button 
            className="flex-1 h-full flex flex-col items-center justify-center gap-2 p-2 sm:p-4 text-xs sm:text-base"
            onClick={() => setIsAdding(!isAdding)}
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </Button>
          <div className="flex-1">
             <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
             <Button 
              variant="secondary"
              className="w-full h-full flex flex-col items-center justify-center gap-2 p-2 sm:p-4 text-xs sm:text-base"
              onClick={() => fileInputRef.current?.click()}
              isLoading={processingReceipt}
            >
              <Camera className="w-5 h-5" />
              Scan Receipt
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: List or Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Add Expense Form */}
          {isAdding && (
            <Card className="p-4 sm:p-6 border-2 border-primary/20 bg-white dark:bg-gray-800">
               <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">New Expense in "{folders.find(f => f.id === activeFolderId)?.name}"</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input 
                  label="Description" 
                  value={newExpense.description} 
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                />
                 <Input 
                  label={`Amount (${symbol})`}
                  type="number" 
                  value={newExpense.amount} 
                  onChange={(e) => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                />
                 <Input 
                  label="Date" 
                  type="date" 
                  value={newExpense.date} 
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                />
                 <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                        {!isCreatingCategory ? (
                             <button onClick={() => setIsCreatingCategory(true)} className="text-xs text-primary hover:underline flex items-center">
                                 <Plus className="w-3 h-3 mr-1" /> New
                             </button>
                        ) : (
                             <button onClick={() => setIsCreatingCategory(false)} className="text-xs text-red-500 hover:underline">Cancel</button>
                        )}
                    </div>
                    
                    {!isCreatingCategory ? (
                        <select 
                            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg"
                            value={newExpense.category}
                            onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    ) : (
                        <div className="flex gap-2">
                            <input 
                                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="New Category Name"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                autoFocus
                            />
                            <Button size="sm" onClick={handleAddCategory}>Add</Button>
                        </div>
                    )}
                 </div>
                 <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paid By</label>
                    <select 
                      className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg"
                      value={newExpense.payerId}
                      onChange={(e) => setNewExpense({...newExpense, payerId: e.target.value})}
                    >
                      {travelers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                 </div>
                 <div className="mb-4 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Split Between</label>
                    <div className="flex flex-wrap gap-2">
                      {travelers.map(t => (
                        <button
                          key={t.id}
                          onClick={() => {
                            const current = newExpense.splitBetween || [];
                            const updated = current.includes(t.id) 
                              ? current.filter(id => id !== t.id)
                              : [...current, t.id];
                            setNewExpense({...newExpense, splitBetween: updated});
                          }}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            newExpense.splitBetween?.includes(t.id)
                              ? 'bg-primary text-white border-primary'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                 </div>
               </div>
               <div className="flex justify-end gap-2 mt-4">
                 <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                 <Button onClick={handleAddExpense}>Save Expense</Button>
               </div>
            </Card>
          )}

          {/* Views Tabs */}
          <div className="flex justify-between items-end border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-1 sm:space-x-2">
                <button
                onClick={() => setActiveView('list')}
                className={`pb-2 px-2 sm:px-4 text-xs sm:text-sm font-medium transition-colors ${activeView === 'list' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                Recent
                </button>
                <button
                onClick={() => setActiveView('analytics')}
                className={`pb-2 px-2 sm:px-4 text-xs sm:text-sm font-medium transition-colors ${activeView === 'analytics' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                Analytics
                </button>
                <button
                onClick={() => setActiveView('settle')}
                className={`pb-2 px-2 sm:px-4 text-xs sm:text-sm font-medium transition-colors ${activeView === 'settle' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                Settle Debts
                </button>
            </div>
            
            {(activeView === 'analytics' || activeView === 'settle') && (
                <div className="pb-2">
                    <label className="flex items-center cursor-pointer">
                        <span className="mr-2 text-xs text-gray-500 dark:text-gray-400">{viewAllFolders ? 'All' : 'Current'}</span>
                        <div className="relative">
                        <input type="checkbox" className="sr-only" checked={viewAllFolders} onChange={() => setViewAllFolders(!viewAllFolders)} />
                        <div className={`block w-8 h-5 rounded-full ${viewAllFolders ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${viewAllFolders ? 'transform translate-x-3' : ''}`}></div>
                        </div>
                    </label>
                </div>
            )}
          </div>

          {activeView === 'list' && (
            <div className="space-y-4">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 mb-2">No expenses in this folder.</p>
                    <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)}>Add your first expense</Button>
                </div>
              ) : (
                filteredExpenses.map(expense => (
                  <Card key={expense.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300`}>
                        {expense.category === 'Food' ? '🍔' : 
                         expense.category === 'Transport' ? '🚕' : 
                         expense.category === 'Accommodation' ? '🏨' :
                         expense.category === 'Activity' ? '🎟️' : 
                         expense.category === 'Other' ? '📄' : '🏷️'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-1">{expense.description}</h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                           <span>{travelers.find(t => t.id === expense.payerId)?.name}</span>
                           <span>•</span>
                           <span>{expense.date}</span>
                           <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">{expense.category}</span>
                           {viewAllFolders && expense.folderId && (
                               <>
                                <span className="hidden sm:inline">•</span>
                                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                    {folders.find(f => f.id === expense.folderId)?.name}
                                </span>
                               </>
                           )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                      <span className="font-bold text-lg text-gray-900 dark:text-white">{symbol}{expense.amount.toFixed(2)}</span>
                      <button 
                        onClick={() => onUpdateExpenses(expenses.filter(e => e.id !== expense.id))}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeView === 'analytics' && (
             <Card className="p-6 h-96">
               <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                 <PieChart className="w-5 h-5 text-gray-500" />
                 Spend by Category {viewAllFolders ? '(All)' : `(${folders.find(f => f.id === activeFolderId)?.name})`}
               </h3>
               {filteredExpenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                    <Pie
                        data={getChartData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {getChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <ReTooltip formatter={(value: number) => `${symbol}${value.toFixed(2)}`} />
                    <Legend />
                    </RePieChart>
                </ResponsiveContainer>
               ) : (
                   <div className="h-full flex items-center justify-center text-gray-400">No data to display</div>
               )}
             </Card>
          )}

          {activeView === 'settle' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Settlements {viewAllFolders ? '(All)' : `(${folders.find(f => f.id === activeFolderId)?.name})`}
              </h3>
              {calculateSettlements().length === 0 ? (
                <div className="text-center py-12 text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-100 dark:border-green-800">
                  <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  All settled up! No one owes anything.
                </div>
              ) : (
                calculateSettlements().map((settlement, idx) => (
                  <Card key={idx} className="p-5 flex items-center justify-between border-l-4 border-l-secondary bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {travelers.find(t => t.id === settlement.fromId)?.name}
                      </div>
                      <div className="flex flex-col items-center px-2">
                         <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">owes</span>
                         <ArrowRight className="w-4 h-4 text-gray-300" />
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {travelers.find(t => t.id === settlement.toId)?.name}
                      </div>
                    </div>
                    <span className="font-bold text-lg text-secondary">{symbol}{settlement.amount.toFixed(2)}</span>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Col: Travelers */}
        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5" /> Travelers
              </h3>
            </div>
            <div className="space-y-3">
              {travelers.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{t.name}</span>
                  {travelers.length > 1 && (
                    <button 
                      onClick={() => onUpdateTravelers(travelers.filter(tr => tr.id !== t.id))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.currentTarget.elements[0] as HTMLInputElement);
                    if (input.value) {
                      onUpdateTravelers([...travelers, { id: Date.now().toString(), name: input.value }]);
                      input.value = '';
                    }
                  }}
                  className="flex gap-2"
                >
                  <input 
                    placeholder="Add name..." 
                    className="flex-1 px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder-gray-400"
                  />
                  <Button type="submit" variant="outline" size="sm">Add</Button>
                </form>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};