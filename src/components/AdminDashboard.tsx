import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Package, ShoppingCart, Utensils, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

import { useLanguage } from '../contexts/LanguageContext';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#06b6d4'];

export function AdminDashboard() {
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7'); // 7, 30, 90 days

  useEffect(() => {
    const pQuery = query(collection(db, 'purchases'), orderBy('date', 'desc'));
    const cQuery = query(collection(db, 'consumptions'), orderBy('date', 'desc'));

    const unsubscribeP = onSnapshot(pQuery, (pSnap) => {
      const pData = pSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || new Date(data.date)
        };
      });
      setPurchases(pData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'purchases');
    });

    const unsubscribeC = onSnapshot(cQuery, (cSnap) => {
      const cData = cSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || new Date(data.date)
        };
      });
      setConsumptions(cData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'consumptions');
      setLoading(false);
    });

    return () => {
      unsubscribeP();
      unsubscribeC();
    };
  }, []);

  const filterByDate = (data: any[]) => {
    const cutoff = subDays(new Date(), parseInt(timeRange));
    return data.filter(item => {
      const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
      return isAfter(itemDate, cutoff);
    });
  };

  const filteredPurchases = filterByDate(purchases);
  const filteredConsumptions = filterByDate(consumptions);

  // Total Stats
  const totalPurchaseWeight = filteredPurchases.reduce((acc, curr) => acc + (parseFloat(curr.weight) || 0), 0);
  const totalConsumptionWeight = filteredConsumptions.reduce((acc, curr) => acc + (parseFloat(curr.weight) || 0), 0);
  const currentStockWeight = totalPurchaseWeight - totalConsumptionWeight;

  // Item-wise Analysis
  const itemStats: Record<string, { purchase: number; consumption: number; unit: string }> = {};
  
  purchases.forEach(p => {
    if (!itemStats[p.itemName]) itemStats[p.itemName] = { purchase: 0, consumption: 0, unit: p.unit || 'KG' };
    itemStats[p.itemName].purchase += parseFloat(p.weight) || 0;
  });

  consumptions.forEach(c => {
    if (!itemStats[c.itemName]) itemStats[c.itemName] = { purchase: 0, consumption: 0, unit: c.unit || 'KG' };
    itemStats[c.itemName].consumption += parseFloat(c.weight) || 0;
  });

  const chartData = Object.entries(itemStats)
    .map(([name, stats]) => ({
      name,
      purchase: stats.purchase,
      consumption: stats.consumption,
      stock: stats.purchase - stats.consumption,
      unit: stats.unit
    }))
    .sort((a, b) => b.purchase - a.purchase)
    .slice(0, 10);

  // Low Stock Alerts
  const lowStockItems = chartData.filter(item => item.stock < 10);

  // Daily Trends
  const dailyData: Record<string, { date: string; purchase: number; consumption: number }> = {};
  [...filteredPurchases, ...filteredConsumptions].forEach(item => {
    const date = item.date instanceof Date ? format(item.date, 'yyyy-MM-dd') : item.date;
    if (!dailyData[date]) dailyData[date] = { date, purchase: 0, consumption: 0 };
    if (item.source) dailyData[date].purchase += parseFloat(item.weight) || 0;
    else dailyData[date].consumption += parseFloat(item.weight) || 0;
  });
  const trendData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-foreground tracking-tight">{t('admin_dashboard')}</h2>
          <p className="text-muted-foreground text-lg mt-1">{t('dashboard_desc')}</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-border no-print">
          {[
            { label: t('7_days'), value: '7' },
            { label: t('30_days'), value: '30' },
            { label: t('90_days'), value: '90' }
          ].map((range) => (
            <Button
              key={range.value}
              variant={timeRange === range.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(range.value)}
              className={cn(
                "rounded-xl text-xs h-9 px-4 font-bold transition-all", 
                timeRange === range.value && "shadow-lg shadow-primary/20"
              )}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t('total_purchase')} 
          value={totalPurchaseWeight.toFixed(2)} 
          unit={t('total')} 
          icon={<ShoppingCart className="h-6 w-6" />} 
          trend="+12%" 
          color="blue"
          delay={0.1}
        />
        <StatCard 
          title={t('total_consumption')} 
          value={totalConsumptionWeight.toFixed(2)} 
          unit={t('total')} 
          icon={<Utensils className="h-6 w-6" />} 
          trend="-5%" 
          color="pink"
          delay={0.2}
        />
        <StatCard 
          title={t('current_stock')} 
          value={currentStockWeight.toFixed(2)} 
          unit={t('total')} 
          icon={<Package className="h-6 w-6" />} 
          trend="+8%" 
          color="indigo"
          delay={0.3}
        />
        <StatCard 
          title={t('low_stock_alert')} 
          value={lowStockItems.length.toString()} 
          unit={t('items')} 
          icon={<AlertTriangle className="h-6 w-6" />} 
          trend={t('urgent')} 
          color="amber"
          isAlert={lowStockItems.length > 0}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Comparison Chart */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
          <Card className="border-none neo-shadow overflow-hidden group">
            <CardHeader className="bg-muted/50 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">{t('item_comparison')}</CardTitle>
                  <CardDescription>{t('top_10_desc')}</CardDescription>
                </div>
                <TrendingUp className="h-5 w-5 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardHeader>
            <CardContent className="pt-6 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    interval={0} 
                    height={80} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Bar dataKey="purchase" name={t('purchase')} fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="consumption" name={t('consumption')} fill="#ec4899" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Trend Chart */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
          <Card className="border-none neo-shadow overflow-hidden group">
            <CardHeader className="bg-muted/50 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">{t('daily_trend')}</CardTitle>
                  <CardDescription>{t('stock_movement_desc')}</CardDescription>
                </div>
                <Calendar className="h-5 w-5 text-accent opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardHeader>
            <CardContent className="pt-6 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val) => format(parseISO(val), 'dd MMM')}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Line type="monotone" dataKey="purchase" name={t('purchase')} stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="consumption" name={t('consumption')} stroke="#ec4899" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Low Stock Table */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="border-none neo-shadow overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border">
              <CardTitle className="text-lg font-bold text-foreground">{t('current_stock_report_top_10')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-muted text-muted-foreground text-[10px] uppercase font-black tracking-widest">
                    <tr>
                      <th className="px-6 py-4">{t('item_name')}</th>
                      <th className="px-6 py-4">{t('purchase')}</th>
                      <th className="px-6 py-4">{t('consumption')}</th>
                      <th className="px-6 py-4">{t('stock')}</th>
                      <th className="px-6 py-4">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {chartData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">{item.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{item.purchase.toFixed(2)} {item.unit}</td>
                        <td className="px-6 py-4 text-muted-foreground">{item.consumption.toFixed(2)} {item.unit}</td>
                        <td className="px-6 py-4 font-bold text-foreground">{item.stock.toFixed(2)} {item.unit}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            item.stock < 10 ? "bg-destructive/10 text-destructive" : "bg-[#dcfce7] text-[#16a34a]"
                          )}>
                            {item.stock < 10 ? t('low_stock') : t('sufficient')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card className="border-none neo-shadow overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border">
              <CardTitle className="text-lg font-bold text-foreground">{t('category_stock')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="stock"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ title, value, unit, icon, trend, color, isAlert, delay }: any) {
  const colors: any = {
    blue: "from-blue-500 to-blue-600 text-blue-500 bg-blue-50",
    pink: "from-pink-500 to-pink-600 text-pink-500 bg-pink-50",
    indigo: "from-indigo-500 to-indigo-600 text-indigo-500 bg-indigo-50",
    amber: "from-amber-500 to-amber-600 text-amber-500 bg-amber-50"
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className={cn("border-none neo-shadow overflow-hidden transition-all hover:-translate-y-1", isAlert && "ring-2 ring-red-500 ring-offset-2")}>
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className={cn("p-3 rounded-2xl", colors[color].split(' ').slice(2).join(' '))}>
              {React.cloneElement(icon, { className: cn("h-6 w-6", colors[color].split(' ')[2]) })}
            </div>
            <div className={cn("flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full", 
              trend.startsWith('+') ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
            )}>
              {trend.startsWith('+') ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend}
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black text-foreground tracking-tight">{value}</h3>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{unit}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
