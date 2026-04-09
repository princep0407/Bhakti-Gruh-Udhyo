import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

interface Ingredient {
  id: string;
  name: string;
  category: string;
}

interface ItemSelectorProps {
  onSelectItem: (item: Ingredient) => void;
  selectedItemNames: string[];
  category?: string;
  placeholder?: string;
  className?: string;
}

export function ItemSelector({ onSelectItem, selectedItemNames, category, placeholder, className }: ItemSelectorProps) {
  const { t } = useLanguage();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => doc.data().name as string);
      setDynamicCategories(cats);
    });
  }, []);

  useEffect(() => {
    let q = query(collection(db, 'ingredients'), orderBy('name', 'asc'));
    
    if (category && category !== t('all_categories') && category !== 'બધી' && category !== 'All Categories') {
      q = query(collection(db, 'ingredients'), where('category', '==', category), orderBy('name', 'asc'));
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name, 
        category: doc.data().category 
      } as Ingredient));
      setItems(data);
      setLoading(false);
      
      // Expand all categories initially if "All" is selected
      if (category === t('all_categories') || category === 'બધી' || category === 'All Categories') {
        const initialExpanded: Record<string, boolean> = {};
        dynamicCategories.forEach(cat => { initialExpanded[cat] = false; });
        setExpandedCategories(initialExpanded);
      }
    });
    return unsubscribe;
  }, [category, dynamicCategories, t]);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const renderItemGrid = (itemsToRender: Ingredient[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-1">
      {itemsToRender.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectItem(item)}
          className={cn(
            "p-2 text-sm font-medium rounded-lg border transition-all text-center break-words min-h-[44px] flex items-center justify-center",
            selectedItemNames.includes(item.name)
              ? "bg-primary/20 border-primary text-primary shadow-sm" 
              : "bg-white/50 border-slate-200 text-slate-700 hover:border-primary/50 hover:bg-primary/5"
          )}
        >
          {item.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder || t('search')}
          className={cn("pl-10", className)}
        />
      </div>
      
      <div className="max-h-[400px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">{t('loading')}</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">{t('no_records')}</div>
        ) : (category === t('all_categories') || category === 'બધી' || category === 'All Categories') ? (
          (Array.from(new Set(filteredItems.map(i => i.category))).sort() as string[]).map(cat => {
            const catItems = filteredItems.filter(i => i.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <button 
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100/50 p-2 rounded-lg"
                >
                  {expandedCategories[cat] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {cat} ({catItems.length})
                </button>
                {expandedCategories[cat] && renderItemGrid(catItems)}
              </div>
            );
          })
        ) : (
          renderItemGrid(filteredItems)
        )}
      </div>
    </div>
  );
}
