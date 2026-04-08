import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from './SearchableSelect';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Search, Filter, ChevronDown, ChevronRight, Database, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { CategoryManager } from './CategoryManager';
import { UnitManager } from './UnitManager';
import { useLanguage } from '../contexts/LanguageContext';

interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  parLevel?: number;
}

export function IngredientsManager() {
  const { t } = useLanguage();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ title: '', message: '', onConfirm: () => {} });

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [parLevel, setParLevel] = useState<string>('');

  useEffect(() => {
    const qCats = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCats = onSnapshot(qCats, (snap) => {
      const cats = snap.docs.map(doc => doc.data().name as string);
      setCategories(cats);
      if (cats.length > 0 && !category) {
        setCategory(cats[0]);
      }
      
      // Initialize expanded categories
      const initialExpanded: Record<string, boolean> = {};
      cats.forEach(cat => {
        initialExpanded[cat] = true;
      });
      setExpandedCategories(prev => ({ ...initialExpanded, ...prev }));
    });

    const qUnits = query(collection(db, 'units'), orderBy('name', 'asc'));
    const unsubscribeUnits = onSnapshot(qUnits, (snap) => {
      const unitList = snap.docs.map(doc => doc.data().name as string);
      setUnits(unitList);
      if (unitList.length > 0 && !unit) {
        setUnit(unitList[0]);
      }
    });

    const qIngs = query(collection(db, 'ingredients'), orderBy('name', 'asc'));
    const unsubscribeIngs = onSnapshot(qIngs, (snap) => {
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Ingredient));
      setIngredients(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'ingredients');
    });

    return () => {
      unsubscribeCats();
      unsubscribeUnits();
      unsubscribeIngs();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category) return;

    try {
      const data = { 
        name, 
        category, 
        unit, 
        parLevel: parLevel ? parseFloat(parLevel) : null 
      };
      if (isEditing) {
        await updateDoc(doc(db, 'ingredients', isEditing), data);
        toast.success(t('item_updated'));
      } else {
        await addDoc(collection(db, 'ingredients'), data);
        toast.success(t('item_added'));
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.WRITE, 'ingredients');
    }
  };

  const resetForm = () => {
    setName('');
    setCategory(categories[0] || '');
    setUnit(units[0] || '');
    setParLevel('');
    setIsEditing(null);
  };

  const handleEdit = (ing: Ingredient) => {
    setName(ing.name);
    setCategory(ing.category);
    setUnit(ing.unit || '');
    setParLevel(ing.parLevel?.toString() || '');
    setIsEditing(ing.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      title: t('delete'),
      message: t('confirm_delete_item'),
      onConfirm: async () => {
        setConfirmOpen(false);
        try {
          await deleteDoc(doc(db, 'ingredients', id));
          toast.success(t('item_deleted'));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'ingredients');
        }
      }
    });
    setConfirmOpen(true);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const filteredIngredients = ingredients.filter(ing => 
    ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ing.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allCategories = Array.from(new Set([...categories, ...ingredients.map(i => i.category)])).sort();
  const groupedIngredients = allCategories.reduce((acc, cat) => {
    acc[cat] = filteredIngredients.filter(ing => ing.category === cat);
    return acc;
  }, {} as Record<string, Ingredient[]>);

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="border-none glass neo-shadow overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b border-white/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-gradient">
              {isEditing ? t('edit_item') : t('add_item')}
            </CardTitle>
            <CardDescription>{t('master_list_desc')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="ing-name">{t('item_name')}</Label>
              <Input 
                id="ing-name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder={t('item_name')}
                className="h-11 bg-white/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-cat">{t('category')}</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  options={categories}
                  value={category}
                  onSelect={setCategory}
                  placeholder={t('select_category')}
                  searchPlaceholder={t('search')}
                  className="flex-1"
                  emptyMessage={t('add_category_first')}
                />
                <CategoryManager />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-unit">{t('unit')}</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  options={units}
                  value={unit}
                  onSelect={setUnit}
                  placeholder={t('unit')}
                  searchPlaceholder={t('search')}
                  className="flex-1"
                  emptyMessage={t('add_unit_first')}
                />
                <UnitManager />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-par">{t('par_level')}</Label>
              <Input 
                id="ing-par" 
                type="number"
                step="0.01"
                value={parLevel} 
                onChange={(e) => setParLevel(e.target.value)} 
                placeholder={t('par_level_placeholder')}
                className="h-11 bg-white/50"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 h-11 gap-2 shadow-lg">
                <Plus className="h-4 w-4" />
                {isEditing ? t('edit') : t('add')}
              </Button>
              {isEditing && (
                <Button type="button" variant="outline" onClick={resetForm} className="h-11">
                  {t('cancel')}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder={t('search')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 glass neo-shadow border-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {allCategories.map(cat => {
            const items = groupedIngredients[cat] || [];
            if (items.length === 0 && searchQuery) return null;
            
            return (
              <div key={cat} className="space-y-2">
                <button 
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between p-4 glass rounded-xl neo-shadow hover:bg-white/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-1.5 rounded-lg group-hover:bg-primary/20 transition-colors">
                      {expandedCategories[cat] ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="font-bold text-slate-700">{cat}</span>
                    <span className="text-xs bg-slate-200/50 px-2 py-0.5 rounded-full text-slate-500">{items.length}</span>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedCategories[cat] && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-2">
                        {items.map(ing => (
                          <div 
                            key={ing.id} 
                            className="flex items-center justify-between p-3 bg-white/60 rounded-xl border border-white/40 shadow-sm hover:shadow-md transition-all group"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700">{ing.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{ing.unit || 'KG'}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(ing)} className="h-8 w-8 text-primary hover:bg-primary/10">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {items.length === 0 && !searchQuery && (
                          <div className="col-span-full p-4 text-center text-slate-400 text-sm italic">
                            {t('no_items_in_category')}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle className="text-xl font-bold">{confirmConfig.title}</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 text-base py-2">
              {confirmConfig.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="flex-1 sm:flex-none">
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmConfig.onConfirm} className="flex-1 sm:flex-none">
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
