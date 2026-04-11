import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, auth } from '../lib/firebase';
import { collection, writeBatch, doc, serverTimestamp, getDoc, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShoppingCart, Plus, Check, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategorySelector } from './CategorySelector';
import { ItemSelector } from './ItemSelector';
import { WeightDialog } from './WeightDialog';
import { SearchableSelect } from './SearchableSelect';
import { useState, useEffect } from 'react';
import { query, orderBy, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { SOURCE_LOCATIONS } from '../constants';

const purchaseSchema = z.object({
  date: z.string().min(1, 'date_required'),
  chalanNo: z.string().optional(),
  billNo: z.string().optional(),
  category: z.string().min(1, 'category_required'),
  source: z.string().min(1, 'source_required'),
  storageLocation: z.enum(SOURCE_LOCATIONS as [string, ...string[]]),
  unit: z.string().min(1, 'unit_required'),
  expiryDate: z.string().optional(),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

interface SelectedItem {
  id: string;
  name: string;
  category: string;
  weight: string;
  unit: string;
}

export function PurchaseForm() {
  const { t } = useLanguage();
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [pendingItem, setPendingItem] = useState<{ id: string; name: string; category: string; weight?: string; unit?: string } | null>(null);
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [units, setUnits] = useState<string[]>([]);
  const [currentStock, setCurrentStock] = useState<Record<string, number>>({});
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const stockMap: Record<string, number> = {};
        const pSnap = await getDocs(collection(db, 'purchases'));
        const cSnap = await getDocs(collection(db, 'consumptions'));

        pSnap.docs.forEach(doc => {
          const data = doc.data();
          const key = `${data.itemName}_${data.unit}`;
          stockMap[key] = (stockMap[key] || 0) + (data.weight || 0);
        });

        cSnap.docs.forEach(doc => {
          const data = doc.data();
          const key = `${data.itemName}_${data.unit}`;
          stockMap[key] = (stockMap[key] || 0) - (data.weight || 0);
        });

        setCurrentStock(stockMap);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'stock');
      }
    };

    fetchStock();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserName(userDoc.data().displayName || auth.currentUser.email?.split('@')[0] || 'Unknown');
        }
      }
    };
    fetchUser();
  }, []);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      category: t('all_categories'),
      source: '',
      storageLocation: 'loc_main_store',
      unit: 'KG',
    }
  });

  useEffect(() => {
    const q = query(collection(db, 'units'), orderBy('name', 'asc'));
    return onSnapshot(q, (snap) => {
      const unitList = snap.docs.map(doc => doc.data().name as string);
      setUnits(unitList);
      if (unitList.length > 0 && !watch('unit')) {
        setValue('unit', unitList[0]);
      }
    });
  }, [setValue, watch]);

  const selectedCategory = watch('category');
  const selectedUnit = watch('unit');

  const handleSelectItem = (item: { id: string; name: string; category: string; unit?: string }) => {
    const existingItem = selectedItems.find(i => i.id === item.id);
    setPendingItem({ 
      ...item, 
      weight: existingItem?.weight || '',
      unit: item.unit || selectedUnit 
    });
    setIsWeightDialogOpen(true);
  };

  const handleWeightConfirm = (weight: string) => {
    if (pendingItem) {
      setSelectedItems(prev => {
        const index = prev.findIndex(i => i.id === pendingItem.id);
        const itemToAdd = { 
          ...pendingItem, 
          weight, 
          unit: pendingItem.unit || selectedUnit 
        } as SelectedItem;

        if (index >= 0) {
          const newItems = [...prev];
          newItems[index] = itemToAdd;
          return newItems;
        }
        return [...prev, itemToAdd];
      });
      setPendingItem(null);
    }
  };

  const removeItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: PurchaseFormValues) => {
    if (!auth.currentUser) return;
    if (selectedItems.length === 0) {
      toast.error(t('select_at_least_one'));
      return;
    }

    try {
      const batch = writeBatch(db);
      const purchasesRef = collection(db, 'purchases');

      selectedItems.forEach(item => {
        const newDocRef = doc(purchasesRef);
        const purchaseData: any = {
          ...data,
          itemName: item.name,
          category: item.category,
          weight: parseFloat(item.weight),
          date: new Date(data.date),
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser!.uid,
          createdByName: userName || auth.currentUser!.email?.split('@')[0] || 'Unknown',
        };

        if (data.expiryDate) {
          purchaseData.expiryDate = new Date(data.expiryDate);
        } else {
          purchaseData.expiryDate = null;
        }

        batch.set(newDocRef, purchaseData);
      });

      await batch.commit();

      // Save to Google Sheets
      await fetch('/api/save-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: selectedItems.map(item => ({
            ...data,
            itemName: item.name,
            category: item.category,
            weight: parseFloat(item.weight),
            date: data.date,
            createdBy: auth.currentUser!.uid,
            createdByName: userName || auth.currentUser!.email?.split('@')[0] || 'Unknown',
            expiryDate: data.expiryDate || null,
          })),
          sheetName: 'Purchases',
        }),
      });

      toast.success(`${selectedItems.length} ${t('records_added_success')}`);
      reset();
      setSelectedItems([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'purchases');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none glass neo-shadow overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b border-white/20">
          <CardTitle className="text-2xl flex items-center gap-3 text-gradient">
            <ShoppingCart className="h-6 w-6 text-primary" />
            {t('add_purchase')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-slate-600 font-medium">{t('date')}</Label>
                  <Input id="date" type="date" {...register('date')} className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20 transition-all" />
                  {errors.date && <p className="text-xs text-destructive font-medium">{t(errors.date.message as string)}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source" className="text-slate-600 font-medium">{t('source')}</Label>
                  <Input id="source" placeholder={t('source')} {...register('source')} className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20 transition-all" />
                  {errors.source && <p className="text-xs text-destructive font-medium">{t(errors.source.message as string)}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="storageLocation" className="text-slate-600 font-medium">{t('storage_location')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCE_LOCATIONS.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setValue('storageLocation', loc as any)}
                        className={cn(
                          "p-2 text-xs font-bold rounded-xl border transition-all h-12",
                          watch('storageLocation') === loc
                            ? "bg-primary text-white border-primary shadow-md"
                            : "bg-white/50 border-slate-200 text-slate-600 hover:bg-primary/5"
                        )}
                      >
                        {loc === 'loc_main_store' ? t('main_store') : t('cold_storage')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate" className="text-slate-600 font-medium">{t('expiry_date')}</Label>
                  <Input id="expiryDate" type="date" {...register('expiryDate')} className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20 transition-all" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="chalanNo" className="text-slate-600 font-medium">{t('chalan_no')}</Label>
                  <Input id="chalanNo" placeholder={t('chalan_no')} {...register('chalanNo')} className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20 transition-all" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billNo" className="text-slate-600 font-medium">{t('bill_no')}</Label>
                  <Input id="billNo" placeholder={t('bill_no')} {...register('billNo')} className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20 transition-all" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-slate-600 font-medium">{t('unit')}</Label>
                  <SearchableSelect
                    options={units}
                    value={watch('unit')}
                    onSelect={(val) => setValue('unit', val)}
                    placeholder={t('unit')}
                    searchPlaceholder={t('search')}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="space-y-3">
                  <Label className="text-slate-600 font-medium">{t('select_category')}</Label>
                  <CategorySelector 
                    selectedCategory={selectedCategory}
                    onSelect={(cat) => setValue('category', cat)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-600 font-medium">{t('select_item')}</Label>
                  <ItemSelector 
                    onSelectItem={handleSelectItem}
                    selectedItemNames={selectedItems.map(i => i.name)}
                    category={selectedCategory}
                    placeholder={t('search')}
                    className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {selectedItems.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <Label className="text-primary font-bold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('selected_items')} ({selectedItems.length})
                  </Label>
                  <div className="grid gap-2">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-xl animate-in fade-in slide-in-from-left-2">
                        <div 
                          className="flex flex-col flex-1 cursor-pointer hover:opacity-70 transition-opacity"
                          onClick={() => handleSelectItem({ id: item.id, name: item.name, category: item.category })}
                        >
                          <span className="font-bold text-slate-900">{item.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{item.category}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div 
                            className="bg-white px-3 py-1 rounded-lg border border-primary/20 shadow-sm cursor-pointer hover:border-primary transition-colors"
                            onClick={() => handleSelectItem({ id: item.id, name: item.name, category: item.category, unit: item.unit })}
                          >
                            <span className="font-bold text-primary">{item.weight}</span>
                            <span className="text-[10px] text-slate-400 ml-1">{item.unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full h-14 text-xl font-bold gap-3 shadow-lg hover:shadow-primary/20 transition-all" disabled={isSubmitting || selectedItems.length === 0}>
              <Plus className="h-6 w-6" />
              {selectedItems.length > 0 ? `${selectedItems.length} ${t('add_records')}` : t('add_record')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <WeightDialog 
        isOpen={isWeightDialogOpen}
        onClose={() => setIsWeightDialogOpen(false)}
        onConfirm={handleWeightConfirm}
        itemName={pendingItem?.name || ''}
        initialWeight={pendingItem?.weight || ''}
        stock={pendingItem ? currentStock[`${pendingItem.name}_${pendingItem.unit || selectedUnit}`] : undefined}
        unit={pendingItem?.unit || selectedUnit}
      />
    </div>
  );
}
