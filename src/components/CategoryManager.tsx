import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings2, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Category {
  id: string;
  name: string;
  order?: number;
}

export function CategoryManager() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
    });
  }, []);

  const handleAdd = async () => {
    if (!newCategory.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategory.trim(),
        order: categories.length
      });
      setNewCategory('');
      toast.success(t('category_added'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await updateDoc(doc(db, 'categories', id), {
        name: editingName.trim()
      });
      setEditingId(null);
      toast.success(t('category_updated'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'categories');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
      setDeleteConfirmId(null);
      toast.success(t('category_deleted'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'categories');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-slate-400 hover:text-primary")}>
        <Settings2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] glass">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">{t('category_management')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder={t('new_category_name')}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="bg-white/50"
            />
            <Button onClick={handleAdd} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 p-2 bg-white/30 rounded-lg border border-white/50 group">
                {editingId === cat.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8 bg-white"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleUpdate(cat.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-slate-700">{cat.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {deleteConfirmId === cat.id ? (
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-7 px-2 text-[10px]" 
                            onClick={() => handleDelete(cat.id)}
                          >
                            {t('confirm')}
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-slate-400" 
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-slate-400 hover:text-blue-600" 
                            onClick={() => {
                              setEditingId(cat.id);
                              setEditingName(cat.name);
                              setDeleteConfirmId(null);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-slate-400 hover:text-red-600" 
                            onClick={() => setDeleteConfirmId(cat.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
