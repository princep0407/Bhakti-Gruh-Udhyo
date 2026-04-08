import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, Download, Printer, Table as TableIcon, 
  AlertTriangle, Package, TrendingUp, History, 
  Scale, Calendar, ClipboardList, PieChart as PieChartIcon,
  Search, Filter, Plus, Receipt
} from 'lucide-react';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';
import TableRenderers from 'react-pivottable/TableRenderers';
import Plot from 'react-plotly.js';
import createPlotlyRenderers from 'react-pivottable/PlotlyRenderers';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, isAfter, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { cn } from '@/lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { InvoiceGenerator } from './InvoiceGenerator';

const PlotlyRenderers = createPlotlyRenderers(Plot);
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#06b6d4'];

export function Reports() {
  const { t } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [stockTakes, setStockTakes] = useState<any[]>([]);
  const [pivotState, setPivotState] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pivot');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyFilter, setDailyFilter] = useState<'all' | 'purchase' | 'consumption'>('all');

  // Stock Take Form State
  const [showStockTakeForm, setShowStockTakeForm] = useState(false);
  const [selectedItemForAudit, setSelectedItemForAudit] = useState('');
  const [actualStockInput, setActualStockInput] = useState('');
  const [auditNotes, setAuditNotes] = useState('');

  useEffect(() => {
    const pQuery = query(collection(db, 'purchases'), orderBy('date', 'desc'));
    const cQuery = query(collection(db, 'consumptions'), orderBy('date', 'desc'));
    const iQuery = query(collection(db, 'ingredients'), orderBy('name', 'asc'));
    const sQuery = query(collection(db, 'stockTakes'), orderBy('date', 'desc'));

    let purchases: any[] = [];
    let consumptions: any[] = [];

    const updateData = () => {
      setData([...purchases, ...consumptions]);
      setLoading(false);
    };

    const unsubscribeP = onSnapshot(pQuery, (pSnap) => {
      purchases = pSnap.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          type: 'purchase',
          weight: parseFloat(d.weight) || 0,
          date: d.date?.toDate() || new Date(d.date)
        };
      });
      updateData();
    });

    const unsubscribeC = onSnapshot(cQuery, (cSnap) => {
      consumptions = cSnap.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          type: 'consumption',
          weight: parseFloat(d.weight) || 0,
          date: d.date?.toDate() || new Date(d.date)
        };
      });
      updateData();
    });

    const unsubscribeI = onSnapshot(iQuery, (iSnap) => {
      setIngredients(iSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubscribeS = onSnapshot(sQuery, (sSnap) => {
      setStockTakes(sSnap.docs.map(doc => ({ 
        ...doc.data(), 
        id: doc.id,
        date: doc.data().date?.toDate() || new Date(doc.data().date)
      })));
    });

    return () => {
      unsubscribeP();
      unsubscribeC();
      unsubscribeI();
      unsubscribeS();
    };
  }, []);

  // Computed Stock Data
  const stockSummary = useMemo(() => {
    const summary: Record<string, any> = {};
    
    ingredients.forEach(ing => {
      summary[ing.name] = {
        name: ing.name,
        category: ing.category,
        unit: ing.unit,
        parLevel: ing.parLevel || 0,
        purchase: 0,
        consumption: 0,
        locations: { 'loc_main_store': 0, 'loc_cold_storage': 0 }
      };
    });

    data.forEach(item => {
      if (!summary[item.itemName]) return;
      if (item.type === 'purchase') {
        summary[item.itemName].purchase += item.weight;
        // Default purchases to Main Store if not specified
        summary[item.itemName].locations['loc_main_store'] += item.weight;
      } else {
        summary[item.itemName].consumption += item.weight;
        if (item.sourceLocation) {
          summary[item.itemName].locations[item.sourceLocation] -= item.weight;
        }
      }
    });

    return Object.values(summary).map(s => ({
      ...s,
      currentStock: s.purchase - s.consumption,
      isLow: (s.purchase - s.consumption) <= s.parLevel
    }));
  }, [data, ingredients]);

  // Daily Report Data
  useEffect(() => {
    setDailyFilter('all');
  }, [selectedDate]);

  const dailyReportData = useMemo(() => {
    const report: Record<string, { date: string, purchase: number, consumption: number }> = {};
    
    data.forEach(item => {
      const dateStr = format(item.date, 'yyyy-MM-dd');
      if (!report[dateStr]) {
        report[dateStr] = { date: dateStr, purchase: 0, consumption: 0 };
      }
      if (item.type === 'purchase') {
        report[dateStr].purchase += item.weight;
      } else {
        report[dateStr].consumption += item.weight;
      }
    });

    return Object.values(report).sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const dailyDetails = useMemo(() => {
    if (!selectedDate) return null;
    return data.filter(item => format(item.date, 'yyyy-MM-dd') === selectedDate);
  }, [data, selectedDate]);

  const handleStockTakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAudit || !actualStockInput) return;

    const item = stockSummary.find(s => s.name === selectedItemForAudit);
    if (!item) return;

    const theoretical = item.currentStock;
    const actual = parseFloat(actualStockInput);
    const variance = actual - theoretical;

    try {
      await addDoc(collection(db, 'stockTakes'), {
        date: serverTimestamp(),
        itemName: selectedItemForAudit,
        theoreticalStock: theoretical,
        actualStock: actual,
        variance: variance,
        unit: item.unit,
        notes: auditNotes,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid
      });
      toast.success(t('audit_added'));
      setActualStockInput('');
      setAuditNotes('');
      setShowStockTakeForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stockTakes');
    }
  };

  const exportToExcel = () => {
    try {
      const formattedData = data.map(item => ({
        ...item,
        date: item.date instanceof Date ? format(item.date, 'dd/MM/yyyy') : item.date,
        weight: `${item.weight} ${item.unit || ''}`
      }));
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");
      XLSX.writeFile(wb, `Inventory_Report_${new Date().toLocaleDateString()}.xlsx`);
      toast.success('Excel downloaded');
    } catch (error) {
      toast.error(t('error_occurred'));
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.text("Inventory Management Report", 14, 15);
      
      const tableData = data.map(item => [
        item.date instanceof Date ? format(item.date, 'dd/MM/yyyy') : item.date,
        item.type === 'purchase' ? t('purchase') : t('consumption'),
        item.itemName,
        item.category,
        item.weight,
        item.unit,
        t(item.source || item.usageType || '')
      ]);

      (doc as any).autoTable({
        head: [[t('date'), t('type'), t('item_name'), t('category'), t('qty'), t('unit'), t('source')]],
        body: tableData,
        startY: 20,
      });

      doc.save(`Inventory_Report_${new Date().toLocaleDateString()}.pdf`);
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error(t('error_occurred'));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredStockSummary = stockSummary.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold text-foreground">{t('reports_analysis')}</h2>
        <div className="flex flex-wrap gap-2 no-print">
          <Button onClick={exportToExcel} variant="outline" className="gap-2 bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0] hover:bg-[#dcfce7]">
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" className="gap-2 bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            {t('print')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-7 h-auto p-1 bg-muted/50 neo-shadow no-print">
          <TabsTrigger value="pivot" className="py-2.5">
            <TableIcon className="h-4 w-4 mr-2" />
            {t('pivot_table')}
          </TabsTrigger>
          <TabsTrigger value="daily" className="py-2.5">
            <Calendar className="h-4 w-4 mr-2" />
            {t('daily_report')}
          </TabsTrigger>
          <TabsTrigger value="stock" className="py-2.5">
            <Package className="h-4 w-4 mr-2" />
            {t('stock_report')}
          </TabsTrigger>
          <TabsTrigger value="usage" className="py-2.5">
            <TrendingUp className="h-4 w-4 mr-2" />
            {t('usage_analysis')}
          </TabsTrigger>
          <TabsTrigger value="purchase" className="py-2.5">
            <History className="h-4 w-4 mr-2" />
            {t('purchase_history')}
          </TabsTrigger>
          <TabsTrigger value="audit" className="py-2.5">
            <Scale className="h-4 w-4 mr-2" />
            {t('audit_accounting')}
          </TabsTrigger>
          <TabsTrigger value="invoice" className="py-2.5">
            <Receipt className="h-4 w-4 mr-2" />
            {t('invoice')}
          </TabsTrigger>
        </TabsList>

        {/* Pivot Table Tab */}
        <TabsContent value="pivot" className="mt-6">
          <Card className="border-none neo-shadow overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <TableIcon className="h-5 w-5 text-primary" />
                {t('custom_report')}
              </CardTitle>
              <CardDescription>{t('drag_drop_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div className="p-4 min-w-[800px]">
                <PivotTableUI
                  data={data.map(d => ({...d, type: d.type === 'purchase' ? t('purchase') : t('consumption'), usageType: t(d.usageType), sourceLocation: t(d.sourceLocation)}))}
                  onChange={s => setPivotState(s)}
                  renderers={Object.assign({}, TableRenderers, PlotlyRenderers)}
                  {...pivotState}
                  unusedOrientationVertical={true}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Report Tab */}
        <TabsContent value="daily" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {t('daily_report')}
                </CardTitle>
                <CardDescription>Select a date to view details</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground font-medium sticky top-0 z-10 border-y border-border">
                      <tr>
                        <th className="px-4 py-3 text-left">{t('date')}</th>
                        <th className="px-4 py-3 text-right">{t('net_change')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dailyReportData.map((d, i) => (
                        <tr 
                          key={i} 
                          className={cn(
                            "hover:bg-primary/5 cursor-pointer transition-colors",
                            selectedDate === d.date && "bg-primary/10"
                          )}
                          onClick={() => setSelectedDate(d.date)}
                        >
                          <td className="px-4 py-3 text-muted-foreground font-medium">
                            {format(new Date(d.date + 'T00:00:00'), 'dd/MM/yyyy')}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-right font-bold",
                            (d.purchase - d.consumption) > 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {(d.purchase - d.consumption).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm lg:col-span-2 min-h-[400px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    {selectedDate ? `${t('details_for')} ${format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy')}` : t('select_date_details')}
                  </CardTitle>
                </div>
                {selectedDate && (
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 no-print">
                    <Printer className="h-4 w-4" />
                    {t('print')}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {!selectedDate ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                    <Calendar className="h-12 w-12 mb-4 opacity-20" />
                    <p>{t('select_date_details')}</p>
                  </div>
                ) : (
                  <div className="daily-detail-print">
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <button 
                        onClick={() => setDailyFilter('all')}
                        className={cn(
                          "p-4 rounded-xl border transition-all text-left",
                          dailyFilter === 'all' ? "bg-primary/10 border-primary shadow-sm" : "bg-white border-border hover:bg-slate-50"
                        )}
                      >
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{t('all')}</p>
                        <p className="text-2xl font-black text-primary">
                          {dailyDetails?.length || 0}
                        </p>
                      </button>
                      <button 
                        onClick={() => setDailyFilter('purchase')}
                        className={cn(
                          "p-4 rounded-xl border transition-all text-left",
                          dailyFilter === 'purchase' ? "bg-emerald-50 border-emerald-500 shadow-sm" : "bg-white border-border hover:bg-emerald-50/50"
                        )}
                      >
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">{t('total_purchase')}</p>
                        <p className="text-2xl font-black text-emerald-700">
                          {dailyDetails?.filter(d => d.type === 'purchase').reduce((acc, d) => acc + d.weight, 0).toFixed(2)}
                        </p>
                      </button>
                      <button 
                        onClick={() => setDailyFilter('consumption')}
                        className={cn(
                          "p-4 rounded-xl border transition-all text-left",
                          dailyFilter === 'consumption' ? "bg-rose-50 border-rose-500 shadow-sm" : "bg-white border-border hover:bg-rose-50/50"
                        )}
                      >
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">{t('total_consumption')}</p>
                        <p className="text-2xl font-black text-rose-700">
                          {dailyDetails?.filter(d => d.type === 'consumption').reduce((acc, d) => acc + d.weight, 0).toFixed(2)}
                        </p>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted text-muted-foreground font-medium border-y border-border">
                          <tr>
                            <th className="px-4 py-3 text-left">{t('type')}</th>
                            <th className="px-4 py-3 text-left">{t('item_name')}</th>
                            <th className="px-4 py-3 text-right">{t('qty')}</th>
                            <th className="px-4 py-3 text-left">{t('unit')}</th>
                            <th className="px-4 py-3 text-left">{t('details')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {dailyDetails?.filter(item => dailyFilter === 'all' || item.type === dailyFilter).sort((a, b) => a.type.localeCompare(b.type)).map((item, i) => (
                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                  item.type === 'purchase' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                )}>
                                  {item.type === 'purchase' ? t('purchase') : t('consumption')}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-foreground">{item.itemName}</td>
                              <td className="px-4 py-3 text-right font-bold">{item.weight.toFixed(2)}</td>
                              <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">
                                {item.type === 'purchase' ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1">
                                      <span className="font-bold text-slate-500 uppercase text-[9px]">{t('source')}:</span>
                                      <span className="font-medium">{item.source || '-'}</span>
                                    </div>
                                    {item.billNo && (
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold text-slate-500 uppercase text-[9px]">{t('bill_no')}:</span>
                                        <span>{item.billNo}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1">
                                      <span className="font-bold text-slate-500 uppercase text-[9px]">{t('consumer')}:</span>
                                      <span className="font-medium">{item.consumerName || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="font-bold text-slate-500 uppercase text-[9px]">{t('usage')}:</span>
                                      <span>{t(item.usageType || '-')}</span>
                                    </div>
                                  </div>
                                )}
                                {item.storageLocation && (
                                  <div className="mt-1 flex items-center gap-1 text-[9px] text-primary font-bold uppercase">
                                    <Package className="h-3 w-3" />
                                    {t(item.storageLocation)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Essential Stock Reports Tab */}
        <TabsContent value="stock" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t('search_item_category')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 glass neo-shadow border-none"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className={cn("flex-1 h-12 gap-2", searchQuery === 'low' && "bg-primary/10 border-primary")}
                onClick={() => setSearchQuery(searchQuery === 'low' ? '' : 'low')}
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t('low_stock')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none neo-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {t('current_stock_summary')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground font-medium border-y border-border">
                      <tr>
                        <th className="px-4 py-3 text-left">{t('item_name')}</th>
                        <th className="px-4 py-3 text-left">{t('category')}</th>
                        <th className="px-4 py-3 text-right">{t('stock')}</th>
                        <th className="px-4 py-3 text-left">{t('unit')}</th>
                        <th className="px-4 py-3 text-center">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredStockSummary
                        .filter(s => searchQuery === 'low' ? s.isLow : true)
                        .map((s, i) => (
                        <tr key={i} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.category}</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">{s.currentStock.toFixed(2)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.unit}</td>
                          <td className="px-4 py-3 text-center">
                            {s.isLow ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef3c7] text-[#b45309]">
                                LOW
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dcfce7] text-[#15803d]">
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none neo-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  {t('storage_report')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: t('loc_main_store'), value: filteredStockSummary.reduce((acc, s) => acc + Math.max(0, s.locations['loc_main_store']), 0) },
                          { name: t('loc_cold_storage'), value: filteredStockSummary.reduce((acc, s) => acc + Math.max(0, s.locations['loc_cold_storage']), 0) }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#6366f1" />
                        <Cell fill="#06b6d4" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none neo-shadow lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {t('expiry_tracking')}
                </CardTitle>
                <CardDescription>{t('expiring_in_30_days')}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground font-medium border-y border-border">
                      <tr>
                        <th className="px-4 py-3 text-left">{t('item_name')}</th>
                        <th className="px-4 py-3 text-left">{t('batch_bill_no')}</th>
                        <th className="px-4 py-3 text-left">{t('expiry_date')}</th>
                        <th className="px-4 py-3 text-right">{t('days_left')}</th>
                        <th className="px-4 py-3 text-center">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data
                        .filter(d => d.type === 'ખરીદ (Purchase)' && d.expiryDate)
                        .map(d => {
                          const expDate: any = d.expiryDate?.toDate ? d.expiryDate.toDate() : new Date(d.expiryDate);
                          const diffTime = expDate.getTime() - Date.now();
                          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return { ...d, expDate, daysLeft };
                        })
                        .filter(d => d.daysLeft <= 30)
                        .sort((a, b) => a.daysLeft - b.daysLeft)
                        .map((d, i) => (
                        <tr key={i} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{d.itemName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{d.billNo || d.chalanNo || '-'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{format(d.expDate, 'dd/MM/yyyy')}</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">{d.daysLeft} દિવસ</td>
                          <td className="px-4 py-3 text-center">
                            {d.daysLeft < 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">
                                EXPIRED
                              </span>
                            ) : d.daysLeft <= 7 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef3c7] text-[#b45309]">
                                CRITICAL
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dbeafe] text-[#1d4ed8]">
                                SOON
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {data.filter(d => d.type === 'ખરીદ (Purchase)' && d.expiryDate).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                            {t('no_expiry_data')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Consumption Analytics Tab */}
        <TabsContent value="usage" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none neo-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {t('usage_by_dept')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(data.filter(d => d.type === 'વપરાશ (Consumption)').reduce((acc, d) => {
                      acc[d.usageType] = (acc[d.usageType] || 0) + d.weight;
                      return acc;
                    }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none neo-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  {t('top_10_consumed')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={(Object.entries(data.filter(d => d.type === 'વપરાશ (Consumption)').reduce((acc, d) => {
                      acc[d.itemName] = (acc[d.itemName] || 0) + d.weight;
                      return acc;
                    }, {} as Record<string, number>)) as [string, number][])
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10)
                      .map(([name, value]) => ({ name, value }))}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ec4899" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Purchase Reports Tab */}
        <TabsContent value="purchase" className="mt-6 space-y-6">
          <div className="relative no-print">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('search')}
              value={purchaseSearch}
              onChange={(e) => setPurchaseSearch(e.target.value)}
              className="pl-10 h-12 glass neo-shadow border-none"
            />
          </div>
          <Card className="border-none neo-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {t('purchase_history')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground font-medium border-y border-border">
                    <tr>
                      <th className="px-4 py-3 text-left">{t('date')}</th>
                      <th className="px-4 py-3 text-left">{t('item_name')}</th>
                      <th className="px-4 py-3 text-left">{t('supplier_source')}</th>
                      <th className="px-4 py-3 text-right">{t('qty')}</th>
                      <th className="px-4 py-3 text-left">{t('bill_no')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data
                      .filter(d => d.type === 'ખરીદ (Purchase)')
                      .filter(d => 
                        d.itemName.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
                        (d.source && d.source.toLowerCase().includes(purchaseSearch.toLowerCase())) ||
                        (d.billNo && d.billNo.toLowerCase().includes(purchaseSearch.toLowerCase()))
                      )
                      .slice(0, 50).map((d, i) => (
                      <tr key={i} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{d.date.toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{d.itemName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.source}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{d.weight} {d.unit}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.billNo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit & Variance Tab */}
        <TabsContent value="audit" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-foreground">{t('stock_audit')}</h3>
            <Button onClick={() => setShowStockTakeForm(!showStockTakeForm)} className="gap-2 no-print">
              <Plus className="h-4 w-4" />
              {t('add_new_audit')}
            </Button>
          </div>

          {showStockTakeForm && (
            <Card className="border-none neo-shadow bg-primary/5 no-print">
              <CardContent className="pt-6">
                <form onSubmit={handleStockTakeSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>{t('select_item')}</Label>
                    <select 
                      className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm"
                      value={selectedItemForAudit}
                      onChange={(e) => setSelectedItemForAudit(e.target.value)}
                    >
                      <option value="">{t('select_item')}</option>
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.name}>{ing.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('actual_stock')}</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={actualStockInput}
                      onChange={(e) => setActualStockInput(e.target.value)}
                      placeholder={t('actual_stock')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('notes')}</Label>
                    <Input 
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      placeholder={t('notes')}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">{t('save')}</Button>
                    <Button type="button" variant="outline" onClick={() => setShowStockTakeForm(false)}>{t('cancel')}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="border-none neo-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                {t('variance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground font-medium border-y border-border">
                    <tr>
                      <th className="px-4 py-3 text-left">{t('date')}</th>
                      <th className="px-4 py-3 text-left">{t('item_name')}</th>
                      <th className="px-4 py-3 text-right">{t('system_stock')}</th>
                      <th className="px-4 py-3 text-right">{t('actual_stock')}</th>
                      <th className="px-4 py-3 text-right">{t('variance')}</th>
                      <th className="px-4 py-3 text-left">{t('notes')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stockTakes.map((s, i) => (
                      <tr key={i} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{s.date.toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{s.itemName}</td>
                        <td className="px-4 py-3 text-right">{s.theoreticalStock.toFixed(2)} {s.unit}</td>
                        <td className="px-4 py-3 text-right font-bold">{s.actualStock.toFixed(2)} {s.unit}</td>
                        <td className={cn(
                          "px-4 py-3 text-right font-bold",
                          s.variance < 0 ? "text-destructive" : s.variance > 0 ? "text-[#22c55e]" : "text-muted-foreground"
                        )}>
                          {s.variance > 0 ? '+' : ''}{s.variance.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground italic">{s.notes || '-'}</td>
                      </tr>
                    ))}
                    {stockTakes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                          {t('no_audit_records')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Invoice Tab */}
        <TabsContent value="invoice" className="mt-6">
          <InvoiceGenerator />
        </TabsContent>
      </Tabs>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          .pvtUi { display: none !important; }
          .pvtTable { width: 100% !important; border-collapse: collapse !important; }
          .pvtTable th, .pvtTable td { border: 1px solid #ddd !important; padding: 8px !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .neo-shadow { box-shadow: none !important; }
          .glass { background: white !important; border: 1px solid #ddd !important; }
          
          /* Daily Report Print */
          .daily-detail-print {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            z-index: 9999;
            padding: 2cm !important;
            visibility: visible !important;
          }
          .daily-detail-print * {
            visibility: visible !important;
          }
          body > *:not(.daily-detail-print) {
            display: none !important;
          }
          
          /* Table styling for print */
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #eee !important; padding: 10px !important; }
          thead { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
          
          @page {
            margin: 0;
          }
        }
      `}} />
    </div>
  );
}
