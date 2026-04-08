import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FileText, History, Edit2, Trash2, AlertTriangle, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface LogEntry {
  id: string;
  type: string;
  date: Date;
  itemName: string;
  weight: number;
  unit: string;
  createdByName: string;
  consumerName?: string;
  source?: string;
  category?: string;
}

export function Logs() {
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState<LogEntry[]>([]);
  const [consumptions, setConsumptions] = useState<LogEntry[]>([]);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<LogEntry | null>(null);

  useEffect(() => {
    const qPurchases = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const qConsumptions = query(collection(db, 'consumptions'), orderBy('createdAt', 'desc'));

    const unsubP = onSnapshot(qPurchases, (snap) => {
      const pLogs = snap.docs.map(doc => ({
        id: doc.id,
        type: 'purchase',
        date: doc.data().date instanceof Timestamp ? doc.data().date.toDate() : new Date(doc.data().date),
        itemName: doc.data().itemName,
        weight: doc.data().weight,
        unit: doc.data().unit,
        createdByName: doc.data().createdByName || 'Unknown',
        source: doc.data().source,
        category: doc.data().category
      }));
      setPurchases(pLogs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'purchases');
    });

    const unsubC = onSnapshot(qConsumptions, (snap) => {
      const cLogs = snap.docs.map(doc => ({
        id: doc.id,
        type: 'consumption',
        date: doc.data().date instanceof Timestamp ? doc.data().date.toDate() : new Date(doc.data().date),
        itemName: doc.data().itemName,
        weight: doc.data().weight,
        unit: doc.data().unit,
        createdByName: doc.data().createdByName || 'Unknown',
        consumerName: doc.data().consumerName,
        category: doc.data().category
      }));
      setConsumptions(cLogs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'consumptions');
    });

    return () => { unsubP(); unsubC(); };
  }, []);

  const logs = React.useMemo(() => {
    return [...purchases, ...consumptions].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [purchases, consumptions]);

  const handleDelete = async () => {
    if (!logToDelete) return;
    try {
      const collectionName = logToDelete.type === 'purchase' ? 'purchases' : 'consumptions';
      await deleteDoc(doc(db, collectionName, logToDelete.id));
      toast.success(t('log_deleted'));
      setIsDeleteDialogOpen(false);
      setLogToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, logToDelete.type === 'purchase' ? 'purchases' : 'consumptions');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    try {
      const collectionName = editingLog.type === 'purchase' ? 'purchases' : 'consumptions';
      const updateData: any = {
        weight: Number(editingLog.weight),
        date: Timestamp.fromDate(new Date(editingLog.date))
      };
      if (editingLog.type === 'purchase') {
        updateData.source = editingLog.source;
      } else {
        updateData.consumerName = editingLog.consumerName;
      }

      await updateDoc(doc(db, collectionName, editingLog.id), updateData);
      toast.success(t('log_updated'));
      setIsEditDialogOpen(false);
      setEditingLog(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, editingLog.type === 'purchase' ? 'purchases' : 'consumptions');
    }
  };

  const generateInvoice = async (log: LogEntry) => {
    if (log.type !== 'consumption') return;
    
    toast.loading('Generating Invoice...', { id: 'log-invoice' });

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Add Header
      pdf.setFontSize(24);
      pdf.setTextColor(30, 58, 138); // #1e3a8a
      pdf.text(t('app_title'), 105, 20, { align: 'center' });
      
      pdf.setFontSize(14);
      pdf.setTextColor(100, 116, 139); // #64748b
      pdf.text(`${t('inv_invoice')} / બિલ`, 105, 30, { align: 'center' });
      
      // Add Details using autoTable for clean layout
      (pdf as any).autoTable({
        startY: 40,
        head: [[{ content: t('inv_details'), colSpan: 2, styles: { halign: 'center', fillColor: [30, 58, 138] } }]],
        body: [
          [t('inv_date'), log.date.toLocaleDateString()],
          [t('item_name'), log.itemName],
          [t('inv_qty'), `${log.weight} ${log.unit}`],
          [t('inv_consumer'), log.consumerName || '-'],
          [t('entry_by'), log.createdByName]
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 138] },
        styles: { font: 'helvetica', fontSize: 12 },
        columnStyles: {
          0: { fontStyle: 'bold', width: 50 }
        }
      });
      
      const finalY = (pdf as any).lastAutoTable.finalY;
      
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184); // #94a3b8
      pdf.text(t('comp_gen'), 105, finalY + 20, { align: 'center' });

      pdf.save(`Invoice_${log.id}.pdf`);
      toast.success(t('invoice') + ' generated', { id: 'log-invoice' });
    } catch (error) {
      console.error('Invoice Generation Error:', error);
      toast.error('Failed to generate invoice', { id: 'log-invoice' });
    }
  };

  const printInvoice = async (log: LogEntry) => {
    if (log.type !== 'consumption') return;
    
    toast.loading('Preparing Print...', { id: 'log-print' });

    const tempDiv = document.createElement('div');
    tempDiv.className = 'print-only-invoice';
    tempDiv.style.padding = '40px';
    tempDiv.style.backgroundColor = '#ffffff';
    tempDiv.style.fontFamily = 'sans-serif';
    
    tempDiv.innerHTML = `
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px;">
        <h1 style="font-size: 32px; margin-bottom: 5px; color: #1e3a8a; text-transform: uppercase; font-weight: 900;">${t('app_title')}</h1>
        <p style="font-size: 18px; color: #64748b; font-weight: bold;">${t('inv_invoice')} / બિલ</p>
      </div>
      <div style="margin-bottom: 40px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px;">
        <div>
          <p style="margin: 5px 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">${t('inv_date')}</p>
          <p style="margin: 0; font-size: 16px; font-weight: bold;">${log.date.toLocaleDateString()}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 5px 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">${t('inv_consumer')}</p>
          <p style="margin: 0; font-size: 16px; font-weight: bold;">${log.consumerName || '-'}</p>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
        <thead>
          <tr style="background-color: #1e3a8a; color: #ffffff;">
            <th style="padding: 12px; text-align: left; border: 1px solid #1e3a8a;">${t('item_description')}</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #1e3a8a;">${t('inv_qty')}</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #1e3a8a;">${t('unit')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">${log.itemName}</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${log.weight}</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0;">${log.unit}</td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">${t('comp_gen')}</p>
          <p style="margin: 5px 0;">${t('entry_by')}: ${log.createdByName}</p>
        </div>
        <div style="text-align: center; width: 200px;">
          <div style="border-bottom: 1px solid #000; height: 40px; margin-bottom: 10px;"></div>
          <p style="font-size: 12px; font-weight: bold; text-transform: uppercase;">${t('auth_sign')}</p>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        .no-print { display: none !important; }
        .print-only-invoice { position: absolute; left: 0; top: 0; width: 100%; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(tempDiv);
    
    setTimeout(() => {
      window.print();
      document.body.removeChild(tempDiv);
      document.head.removeChild(style);
      toast.dismiss('log-print');
    }, 500);
  };

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border">
        <CardTitle className="text-2xl flex items-center gap-3 text-primary">
          <History className="h-6 w-6" />
          {t('activity_log')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left whitespace-nowrap">{t('date')}</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">{t('type')}</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">{t('item_name')}</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">{t('qty')}</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">{t('entry_by')}</th>
                <th className="px-6 py-4 text-center whitespace-nowrap no-print">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{log.date.toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      log.type === 'purchase' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {t(log.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-foreground">
                    <div className="font-medium">{log.itemName}</div>
                    {log.type === 'consumption' && log.consumerName && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span className="opacity-50">To:</span> {log.consumerName}
                      </div>
                    )}
                    {log.type === 'purchase' && log.source && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span className="opacity-50">From:</span> {log.source}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-black whitespace-nowrap text-foreground">
                    {log.weight} <span className="text-[10px] font-medium text-muted-foreground">{log.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{log.createdByName}</td>
                  <td className="px-6 py-4 text-center no-print">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {log.type === 'consumption' && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => generateInvoice(log)} title={t('download_pdf')}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => printInvoice(log)} title={t('print')}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => {
                        setEditingLog({ ...log });
                        setIsEditDialogOpen(true);
                      }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => {
                        setLogToDelete(log);
                        setIsDeleteDialogOpen(true);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('edit_log')}</DialogTitle>
          </DialogHeader>
          {editingLog && (
            <form onSubmit={handleUpdate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('item_name')}</Label>
                <Input value={editingLog.itemName} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>{t('date')}</Label>
                <Input 
                  type="date" 
                  value={format(editingLog.date, 'yyyy-MM-dd')} 
                  onChange={(e) => setEditingLog({ ...editingLog, date: new Date(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('qty')}</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={editingLog.weight} 
                  onChange={(e) => setEditingLog({ ...editingLog, weight: Number(e.target.value) })}
                />
              </div>
              {editingLog.type === 'purchase' ? (
                <div className="space-y-2">
                  <Label>{t('source')}</Label>
                  <Input 
                    value={editingLog.source || ''} 
                    onChange={(e) => setEditingLog({ ...editingLog, source: e.target.value })}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t('consumer_name')}</Label>
                  <Input 
                    value={editingLog.consumerName || ''} 
                    onChange={(e) => setEditingLog({ ...editingLog, consumerName: e.target.value })}
                  />
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit">
                  {t('save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle className="text-xl font-bold text-destructive">{t('delete')}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="py-4 text-muted-foreground">
            {t('confirm_delete_log')}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="flex-1 sm:flex-none">
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="flex-1 sm:flex-none">
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
