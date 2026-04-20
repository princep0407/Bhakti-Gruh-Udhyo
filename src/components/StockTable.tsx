import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { History, Search, Calendar as CalendarIcon, X, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useLanguage } from '../contexts/LanguageContext';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface StockTableProps {
  type: 'purchase' | 'consumption';
}

export function StockTable({ type }: StockTableProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    let q = query(
      collection(db, type === 'purchase' ? 'purchases' : 'consumptions'),
      orderBy('date', 'desc')
    );

    if (startDate) {
      q = query(q, where('date', '>=', new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      q = query(q, where('date', '<=', end));
    }

    if (!startDate && !endDate) {
      q = query(q, limit(50));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
      }));
      setData(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, type === 'purchase' ? 'purchases' : 'consumptions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [type]);

  const filteredData = data.filter(item => 
    item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (type === 'purchase' ? item.source : item.consumerName)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToExcel = () => {
    try {
      const formattedData = filteredData.map(item => ({
        Date: item.date ? format(new Date(item.date), 'dd/MM/yyyy') : '',
        [t('item_name')]: item.itemName || '',
        [t('category')]: item.category || '',
        [t('qty')]: `${item.weight} ${item.unit || ''}`,
        [type === 'purchase' ? t('source') : t('consumer_name')]: type === 'purchase' ? item.source : item.consumerName,
        [t('remarks')]: item.remarks || '',
        [t('entry_by')]: item.createdByName || ''
      }));
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${type}_History_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success('Excel downloaded');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border flex flex-col gap-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-2xl flex items-center gap-3 text-primary">
            <History className="h-6 w-6" />
            {startDate || endDate ? t('history') : t('last_50')}
          </CardTitle>
          <div className="relative w-full sm:w-auto sm:min-w-[350px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={t('search')} 
              className="pl-12 h-11 rounded-xl border-slate-200 bg-white focus:ring-primary/20 transition-all" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/60 p-3 rounded-xl border border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">{t('from_date')}:</span>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-auto text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">{t('to_date')}:</span>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-auto text-sm"
              />
            </div>
            {(startDate || endDate) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-slate-500 hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                {t('clear')}
              </Button>
            )}
          </div>
          <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-2 bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0] hover:bg-[#dcfce7]">
            <Download className="h-4 w-4" />
            Excel Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('date')}</TableHead>
                <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('item_name')}</TableHead>
                <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-right">{t('qty')}</TableHead>
                {type === 'purchase' ? (
                  <>
                    <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('chalan_bill')}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('source')}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('remarks')}</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('consumer')}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('usage')}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('from')}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">{t('remarks')}</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={type === 'purchase' ? 6 : 7} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      {t('loading')}
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={type === 'purchase' ? 6 : 7} className="h-32 text-center text-slate-400 font-medium">
                    {t('no_records')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="px-6 py-4 font-medium text-slate-500">
                      {item.date ? format(item.date, 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="font-bold text-slate-900">{item.itemName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">{item.category}</div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="inline-flex flex-col items-end">
                        <span className="text-lg font-black text-primary">
                          {item.weight}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{item.unit || 'KG'}</span>
                      </div>
                    </TableCell>
                    {type === 'purchase' ? (
                      <>
                        <TableCell className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-600">
                            {item.chalanNo || '-'}{item.billNo ? ` / ${item.billNo}` : ''}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-slate-600 font-medium">{item.source}</TableCell>
                        <TableCell className="px-6 py-4 text-slate-500 text-sm">{item.remarks || '-'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="px-6 py-4 text-slate-600 font-medium">{item.consumerName}</TableCell>
                        <TableCell className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                            {t(item.usageType)}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-slate-500 text-sm font-medium">{t(item.sourceLocation)}</TableCell>
                        <TableCell className="px-6 py-4 text-slate-500 text-sm">{item.remarks || '-'}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
