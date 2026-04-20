import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar as CalendarIcon, X, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { format } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export function AnalyticsDashboard() {
  const { t } = useLanguage();
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom Date Range
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return format(date, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  useEffect(() => {
    const q = query(collection(db, 'consumptions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const item = doc.data();
        return {
          ...item,
          dateMs: item.date instanceof Timestamp ? item.date.toMillis() : new Date(item.date).getTime()
        };
      });
      setConsumptions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredData = useMemo(() => {
    if (!startDate && !endDate) return consumptions;
    
    let startMs = 0;
    let endMs = Infinity;

    if (startDate) {
      startMs = new Date(startDate).getTime();
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      endMs = end.getTime();
    }

    return consumptions.filter(item => item.dateMs >= startMs && item.dateMs <= endMs);
  }, [consumptions, startDate, endDate]);

  // Data for Charts
  const chartData = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    const itemMap: Record<string, number> = {};

    filteredData.forEach(item => {
      const weight = typeof item.weight === 'number' ? item.weight : parseFloat(item.weight || 0);
      
      // Category aggregation
      const cat = item.category || 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + weight;

      // Item aggregation
      const name = item.itemName || 'Unknown';
      itemMap[name] = (itemMap[name] || 0) + weight;
    });

    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topItemsData = Object.entries(itemMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 items

    return { categoryData, topItemsData };
  }, [filteredData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-muted/30 border-b border-border py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-xl flex items-center gap-2 text-primary">
              <PieChartIcon className="h-5 w-5" />
              {t('usage_analysis')}
            </CardTitle>
            
            <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">{t('from_date')}:</span>
                <Input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 w-auto text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">{t('to_date')}:</span>
                <Input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 w-auto text-sm"
                />
              </div>
              {(startDate || endDate) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-slate-500 hover:text-destructive h-8 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Category Pie Chart */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2">
                <PieChartIcon className="h-4 w-4" />
                Consumption by Category (Total Kg/Ltr)
              </h3>
              {chartData.categoryData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toFixed(2)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  {t('no_records')}
                </div>
              )}
            </div>

            {/* Top Items Bar Chart */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Top 10 Consumed Items
              </h3>
              {chartData.topItemsData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData.topItemsData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => value.toFixed(2)} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                        {chartData.topItemsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  {t('no_records')}
                </div>
              )}
            </div>
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
