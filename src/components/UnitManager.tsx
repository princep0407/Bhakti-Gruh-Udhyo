import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ruler, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Unit {
  id: string;
  name: string;
}

export function UnitManager() {
  const { t } = useLanguage();
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnit, setNewUnit] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'units'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      setUnits(data);
    });
  }, []);

  const handleAdd = async () => {
    if (!newUnit.trim()) return;
    try {
      await addDoc(collection(db, 'units'), {
        name: newUnit.trim()
      });
      setNewUnit('');
      toast.success(t('unit_added'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'units');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await updateDoc(doc(db, 'units', id), {
        name: editingName.trim()
      });
      setEditingId(null);
      toast.success(t('unit_updated'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'units');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'units', id));
      setDeleteConfirmId(null);
      toast.success(t('unit_deleted'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'units');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-slate-400 hover:text-primary")}>
        <Ruler className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] glass">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">{t('unit_management')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder={t('new_unit_name')}
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="bg-white/50"
            />
            <Button onClick={handleAdd} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
            {units.map((u) => (
              <div key={u.id} className="flex items-center gap-2 p-2 bg-white/30 rounded-lg border border-white/50 group">
                {editingId === u.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8 bg-white"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleUpdate(u.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-slate-700">{u.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {deleteConfirmId === u.id ? (
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-7 px-2 text-[10px]" 
                            onClick={() => handleDelete(u.id)}
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
                              setEditingId(u.id);
                              setEditingName(u.name);
                              setDeleteConfirmId(null);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-slate-400 hover:text-red-600" 
                            onClick={() => setDeleteConfirmId(u.id)}
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
