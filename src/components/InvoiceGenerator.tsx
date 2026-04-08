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
            <div className="invoice-print-area bg-white p-8 sm:p-12 min-h-[800px]">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-foreground pb-8 mb-8">
                <div>
                  <h1 className="text-4xl font-black text-foreground tracking-tight uppercase">{t('app_title')}</h1>
                  <p className="text-muted-foreground mt-1 text-lg">Consumption Invoice / Delivery Challan</p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-muted px-4 py-2 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('inv_invoice')} No</p>
                    <p className="text-xl font-bold text-foreground">{invoiceNo}</p>
                  </div>
                </div>
              </div>
              
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Bill To / {t('inv_consumer')}</p>
                    <p className="text-lg font-bold text-foreground">{consumerName || 'All Consumers'}</p>
                  </div>
                </div>
                <div className="space-y-4 text-right">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('period')}</p>
                    <p className="text-foreground font-medium">{format(new Date(startDate), 'dd MMM, yyyy')} — {format(new Date(endDate), 'dd MMM, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('generated_on')}</p>
                    <p className="text-foreground font-medium">{format(new Date(), 'dd MMM, yyyy HH:mm')}</p>
                  </div>
                </div>
              </div>
 
              {/* Table */}
              <div className="rounded-xl border border-border overflow-hidden mb-8">
                <table className="w-full text-sm text-left">
                  <thead className="bg-foreground text-white font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-16 text-center">{t('sr_no')}</th>
                      <th className="px-4 py-3">{t('inv_date')}</th>
                      <th className="px-4 py-3">{t('item_description')}</th>
                      <th className="px-4 py-3">{t('inv_category')}</th>
                      <th className="px-4 py-3">{t('inv_usage_type')}</th>
                      <th className="px-4 py-3 text-right">{t('inv_qty')}</th>
                      <th className="px-4 py-3 text-center no-print w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {consumptions.map((item, i) => (
                      <tr key={item.id || i} className="hover:bg-muted transition-colors group">
                        <td className="px-4 py-3 text-center text-muted-foreground font-medium">{i + 1}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(item.date, 'dd/MM/yyyy')}</td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          {item.itemName}
                          {!consumerName && item.consumerName && (
                            <span className="block text-xs font-normal text-muted-foreground mt-0.5">{t('inv_consumer')}: {item.consumerName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{t(item.usageType || '-')}</td>
                        <td className="px-4 py-3 text-right font-black text-foreground whitespace-nowrap">
                          {item.weight} <span className="text-xs font-medium text-muted-foreground">{item.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-center no-print">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
              <div className="flex justify-between items-end mt-16 pt-8 border-t border-border">
                <div className="text-muted-foreground text-sm">
                  <p className="font-medium text-foreground flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4" /> {t('total_items')}: {consumptions.length}
                  </p>
                  <p>{t('comp_gen')}</p>
                </div>
                <div className="text-center w-48">
                  <div className="border-b border-muted-foreground h-12 mb-2"></div>
                  <p className="text-sm font-bold text-foreground uppercase tracking-wider">{t('auth_sign')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-print-area, .invoice-print-area * {
            visibility: visible;
          }
          .invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          .print-shadow-none {
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}} />
    </div>
  );
}

