import React, { useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from './SearchableSelect';
import { ItemSelector } from './ItemSelector';
import { CategorySelector } from './CategorySelector';
import { WeightDialog } from './WeightDialog';
import { SOURCE_LOCATIONS } from '../constants';
import { toast } from 'sonner';
import { Package, Trash2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { query, orderBy, onSnapshot } from 'firebase/firestore';

const wastageSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  reason: z.string().min(1, 'Reason is required'),
  sourceLocation: z.string().min(1, 'Source Location is required'),
  category: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  remarks: z.string().optional(),
});

type WastageFormValues = z.infer<typeof wastageSchema>;

interface SelectedItem {
  id?: string;
  name: string;
  weight: string;
  category: string;
  unit: string;
}

export function WastageForm({ userName }: { userName: string }) {
  const { t } = useLanguage();
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [pendingItem, setPendingItem] = useState<{ id?: string, name: string, category: string, unit?: string, weight?: string } | null>(null);
  const [units, setUnits] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<WastageFormValues>({
    resolver: zodResolver(wastageSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      sourceLocation: 'loc_main_store'
    }
  });

  React.useEffect(() => {
    const q = query(collection(db, 'units'), orderBy('name', 'asc'));
    return onSnapshot(q, (snap) => {
      const unitList = snap.docs.map(doc => doc.data().name as string);
      setUnits(unitList);
      if (unitList.length > 0 && !watch('unit')) {
        setValue('unit', unitList[0]);
      }
    });
  }, [setValue, watch]);

  const selectedUnit = watch('unit');

  const handleSelectItem = (item: { id?: string, name: string, category: string, unit?: string }) => {
    if (!selectedUnit && !item.unit) {
      toast.error('Please select a unit first');
      return;
    }
    const existingIndex = selectedItems.findIndex(i => i.name === item.name);
    setPendingItem({
      ...item,
      weight: existingIndex >= 0 ? selectedItems[existingIndex].weight : ''
    });
  };

  const handleWeightConfirm = (weight: string) => {
    if (pendingItem) {
      setSelectedItems(prev => {
        const index = prev.findIndex(item => item.name === pendingItem.name);
        const itemToAdd = { 
          id: pendingItem.id,
          name: pendingItem.name, 
          weight, 
          category: pendingItem.category, 
          unit: pendingItem.unit || selectedUnit 
        };

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

  const onSubmit = async (data: WastageFormValues) => {
    if (!auth.currentUser) return;
    if (selectedItems.length === 0) {
      toast.error(t('select_at_least_one'));
      return;
    }

    try {
      const batch = writeBatch(db);
      const wastageRef = collection(db, 'wastage');

      selectedItems.forEach(item => {
        const newDocRef = doc(wastageRef);
        batch.set(newDocRef, {
          ...data,
          itemName: item.name,
          category: item.category,
          weight: parseFloat(item.weight),
          date: new Date(data.date),
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser!.uid,
          createdByName: userName || auth.currentUser!.email?.split('@')[0] || 'Unknown',
          remarks: data.remarks || '',
          type: 'wastage'
        });
      });

      await batch.commit();

      toast.success(`${selectedItems.length} records added to wastage`);
      reset();
      setSelectedItems([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'wastage');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none glass neo-shadow overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-b border-white/20">
          <CardTitle className="text-2xl flex items-center gap-3 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            Wastage / Spoilage Form
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
                  <Label htmlFor="reason" className="text-slate-600 font-medium">Reason for Wastage</Label>
                  <Input id="reason" placeholder="E.g., Spoiled, Expired, Broken" {...register('reason')} className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20 transition-all" />
                  {errors.reason && <p className="text-xs text-destructive font-medium">{errors.reason.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sourceLocation" className="text-slate-600 font-medium">From Location</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCE_LOCATIONS.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setValue('sourceLocation', loc as any)}
                        className={cn(
                          "p-2 text-xs font-bold rounded-xl border transition-all h-12",
                          watch('sourceLocation') === loc
                            ? "bg-red-500 text-white border-red-500 shadow-md"
                            : "bg-white/50 border-slate-200 text-slate-600 hover:bg-red-500/5"
                        )}
                      >
                        {t(loc)}
                      </button>
                    ))}
                  </div>
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

              <div className="space-y-2">
                <Label htmlFor="remarks" className="text-slate-600 font-medium">{t('remarks')}</Label>
                <textarea 
                  id="remarks" 
                  placeholder={t('remarks')} 
                  {...register('remarks')} 
                  className="w-full min-h-[80px] p-3 rounded-xl bg-white/50 border border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-y text-sm" 
                />
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
                    className="h-12 bg-white/50 border-slate-200 focus:ring-red-500/20 transition-all"
                  />
                </div>
              </div>

              {selectedItems.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <Label className="text-red-500 font-bold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('selected_items')} ({selectedItems.length})
                  </Label>
                  <div className="grid gap-2">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-xl animate-in fade-in slide-in-from-left-2">
                        <div 
                          className="flex flex-col flex-1 cursor-pointer hover:opacity-70 transition-opacity"
                          onClick={() => handleSelectItem({ id: item.id, name: item.name, category: item.category, unit: item.unit })}
                        >
                          <span className="font-bold text-slate-900">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{item.category}</span>
                            <span className="text-[10px] bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                              {item.weight} {item.unit}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-500/10 h-8 w-8 ml-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full h-14 text-lg font-bold shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all bg-red-600 hover:bg-red-700 text-white rounded-xl">
                Add to Wastage
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <WeightDialog
        isOpen={!!pendingItem}
        onClose={() => setPendingItem(null)}
        onConfirm={handleWeightConfirm}
        itemName={pendingItem?.name || ''}
        initialWeight={pendingItem?.weight || ''}
        unit={pendingItem?.unit || selectedUnit}
      />
    </div>
  );
}
