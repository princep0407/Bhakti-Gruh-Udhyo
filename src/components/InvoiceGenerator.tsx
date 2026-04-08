import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt, Printer, Download, Search, FileText, Calendar, User, Package, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export function InvoiceGenerator() {
  const { t } = useLanguage();
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [consumerName, setConsumerName] = useState('');
  const [consumers, setConsumers] = useState<string[]>([]);
  const [invoiceNo, setInvoiceNo] = useState('');

  useEffect(() => {
    const fetchConsumers = async () => {
      const q = query(collection(db, 'consumptions'));
      const snap = await getDocs(q);
      const uniqueConsumers = Array.from(new Set(snap.docs.map(doc => doc.data().consumerName).filter(Boolean)));
      setConsumers(uniqueConsumers as string[]);
    };
    fetchConsumers();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'consumptions'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const filtered = snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: doc.data().date?.toDate() || new Date(doc.data().date)
      })).filter((item: any) => {
        const itemDate = item.date;
        const matchesDate = itemDate >= start && itemDate <= end;
        const matchesConsumer = consumerName ? item.consumerName?.toLowerCase().includes(consumerName.toLowerCase()) : true;
        return matchesDate && matchesConsumer;
      });

      setConsumptions(filtered);
      setInvoiceNo(`INV-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
      
      if (filtered.length === 0) {
        toast.info(t('no_records'));
      } else {
        toast.success(`${t('generate_invoice')}: ${filtered.length} items`);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  const removeItem = (id: string) => {
    setConsumptions(prev => prev.filter(item => item.id !== id));
    toast.info('Item removed from invoice preview');
  };

  const exportPDF = async () => {
    if (consumptions.length === 0) {
      toast.error('No data to export');
      return;
    }

    toast.loading('Generating PDF...', { id: 'pdf-gen' });

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Add Header
      pdf.setFontSize(24);
      pdf.setTextColor(30, 58, 138); // #1e3a8a
      pdf.text(t('app_title'), 105, 20, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setTextColor(100, 116, 139); // #64748b
      pdf.text('Consumption Invoice / Delivery Challan', 105, 28, { align: 'center' });
      
      // Invoice Info
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${t('inv_invoice')} No: ${invoiceNo}`, 20, 40);
      pdf.text(`${t('inv_consumer')}: ${consumerName || 'All Consumers'}`, 20, 46);
      pdf.text(`${t('period')}: ${format(new Date(startDate), 'dd MMM, yyyy')} - ${format(new Date(endDate), 'dd MMM, yyyy')}`, 20, 52);
      pdf.text(`${t('generated_on')}: ${format(new Date(), 'dd MMM, yyyy HH:mm')}`, 20, 58);

      // Table
      const tableData = consumptions.map((item, i) => [
        i + 1,
        format(item.date, 'dd/MM/yyyy'),
        item.itemName,
        item.category,
        t(item.usageType || '-'),
        `${item.weight} ${item.unit}`
      ]);

      (pdf as any).autoTable({
        startY: 65,
        head: [[t('sr_no'), t('inv_date'), t('item_description'), t('inv_category'), t('inv_usage_type'), t('inv_qty')]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 138] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { halign: 'center' },
          5: { halign: 'right' }
        }
      });

      const finalY = (pdf as any).lastAutoTable.finalY;

      // Footer
      pdf.setFontSize(10);
      pdf.text(`${t('total_items')}: ${consumptions.length}`, 20, finalY + 15);
      pdf.text(t('comp_gen'), 20, finalY + 21);
      
      pdf.text(t('auth_sign'), 160, finalY + 35, { align: 'center' });
      pdf.line(140, finalY + 30, 180, finalY + 30);

      pdf.save(`${invoiceNo}.pdf`);
      toast.success('Invoice downloaded successfully', { id: 'pdf-gen' });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.error('Failed to generate PDF', { id: 'pdf-gen' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="border-none glass neo-shadow no-print overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-chart-1/10 border-b border-white/20">
          <CardTitle className="flex items-center gap-2 text-primary">
            <FileText className="h-6 w-6 text-primary" />
            {t('generate_invoice')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-muted-foreground font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {t('from')} {t('date')}
              </Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 bg-white/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {t('expiry_date')}
              </Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 bg-white/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground font-medium flex items-center gap-2">
                <User className="h-4 w-4" /> {t('consumer_name')}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t('search')} 
                  value={consumerName}
                  onChange={(e) => setConsumerName(e.target.value)}
                  className="pl-10 h-11 bg-white/50"
                  list="consumers-list"
                />
                <datalist id="consumers-list">
                  {consumers.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <Button 
              onClick={handleGenerate} 
              className="w-full h-11 gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {t('invoice_preview')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {consumptions.length > 0 && (
        <Card className="border-none bg-white shadow-2xl print-shadow-none overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between bg-muted border-b border-border no-print py-4">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              {t('invoice_preview')}
            </CardTitle>
            <div className="flex gap-3">
              <Button onClick={exportPDF} variant="outline" className="gap-2 text-destructive hover:text-destructive/90 hover:bg-destructive/10 border-destructive/20 h-10">
                <Download className="h-4 w-4" />
                {t('download_pdf')}
              </Button>
              <Button onClick={handlePrint} className="gap-2 bg-foreground hover:bg-foreground/90 text-white h-10">
                <Printer className="h-4 w-4" />
                {t('print_invoice')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
      {/* Invoice Printable Area */}
      <div className="invoice-print-area bg-white p-8 sm:p-12 min-h-[800px] text-black">
        {/* Header */}
        <div className="flex justify-between items-start border-b-4 border-black pb-8 mb-8">
          <div>
            <h1 className="text-5xl font-black tracking-tight uppercase leading-none">{t('app_title')}</h1>
            <p className="text-gray-600 mt-2 text-xl font-bold">Consumption Invoice / Delivery Challan</p>
          </div>
          <div className="text-right">
            <div className="inline-block bg-gray-100 px-6 py-3 rounded-xl border-2 border-gray-200">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">{t('inv_invoice')} No</p>
              <p className="text-2xl font-black">{invoiceNo}</p>
            </div>
          </div>
        </div>
        
        {/* Meta Info */}
        <div className="grid grid-cols-2 gap-12 mb-10">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Bill To / {t('inv_consumer')}</p>
              <p className="text-2xl font-black border-l-4 border-black pl-4 py-1">{consumerName || 'All Consumers'}</p>
            </div>
          </div>
          <div className="space-y-4 text-right">
            <div className="flex flex-col items-end">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t('period')}</p>
              <p className="text-lg font-bold">{format(new Date(startDate), 'dd MMM, yyyy')} — {format(new Date(endDate), 'dd MMM, yyyy')}</p>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t('generated_on')}</p>
              <p className="text-lg font-bold">{format(new Date(), 'dd MMM, yyyy HH:mm')}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border-2 border-black overflow-hidden mb-10 shadow-sm">
          <table className="w-full text-base text-left border-collapse">
            <thead className="bg-black text-white">
              <tr>
                <th className="px-6 py-4 w-20 text-center border-r border-gray-700">{t('sr_no')}</th>
                <th className="px-6 py-4 border-r border-gray-700">{t('inv_date')}</th>
                <th className="px-6 py-4 border-r border-gray-700">{t('item_description')}</th>
                <th className="px-6 py-4 border-r border-gray-700">{t('inv_usage_type')}</th>
                <th className="px-6 py-4 text-right">{t('inv_qty')}</th>
                <th className="px-6 py-4 text-center no-print w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100">
              {consumptions.map((item, i) => (
                <tr key={item.id || i} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 text-center text-gray-500 font-bold border-r border-gray-100">{i + 1}</td>
                  <td className="px-6 py-4 text-gray-600 font-medium whitespace-nowrap border-r border-gray-100">{format(item.date, 'dd/MM/yyyy')}</td>
                  <td className="px-6 py-4 border-r border-gray-100">
                    <p className="font-black text-lg leading-tight">{item.itemName}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{item.category}</p>
                    {!consumerName && item.consumerName && (
                      <p className="text-xs font-bold text-primary mt-1">{t('inv_consumer')}: {item.consumerName}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-bold border-r border-gray-100">{t(item.usageType || '-')}</td>
                  <td className="px-6 py-4 text-right font-black text-xl whitespace-nowrap">
                    {item.weight} <span className="text-sm font-bold text-gray-400">{item.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-center no-print">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-gray-300 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Summary & Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-20 pt-10 border-t-4 border-black">
          <div className="space-y-4">
            <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100 inline-block min-w-[200px]">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" /> Summary
              </p>
              <p className="text-2xl font-black">{t('total_items')}: {consumptions.length}</p>
            </div>
            <p className="text-sm font-bold text-gray-400 italic">{t('comp_gen')}</p>
          </div>
          <div className="flex flex-col items-center justify-end">
            <div className="w-64 border-b-4 border-black mb-4"></div>
            <p className="text-lg font-black uppercase tracking-widest">{t('auth_sign')}</p>
          </div>
        </div>
      </div>
          </CardContent>
        </Card>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print {
            display: none !important;
          }
          .print-shadow-none {
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 1cm;
          }
          .invoice-print-area {
            padding: 2cm !important;
          }
        }
      `}} />
    </div>
  );
}

