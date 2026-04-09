import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '../contexts/LanguageContext';

interface WeightDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (weight: string) => void;
  itemName: string;
  initialWeight?: string;
  stock?: number;
  unit?: string;
}

export function WeightDialog({ isOpen, onClose, onConfirm, itemName, initialWeight = '', stock, unit }: WeightDialogProps) {
  const { t } = useLanguage();
  const [weight, setWeight] = React.useState(initialWeight);

  React.useEffect(() => {
    if (isOpen) {
      setWeight(initialWeight);
    }
  }, [isOpen, initialWeight]);

  const handleConfirm = () => {
    if (weight && parseFloat(weight) > 0) {
      onConfirm(weight);
      setWeight('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">{t('add_weight') || 'વજન ઉમેરો'}</DialogTitle>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-600">{t('item_name')}: <span className="font-bold text-slate-900">{itemName}</span></Label>
            <div className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold inline-block">
              {t('stock')}: {(stock || 0).toFixed(2)} {unit}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-weight" className="text-slate-600 font-medium">{t('qty')} ({t('unit')})</Label>
            <Input
              id="item-weight"
              type="number"
              step="0.001"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={t('qty') + '...'}
              className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-12">{t('cancel')}</Button>
          <Button onClick={handleConfirm} className="h-12 px-8 font-bold" disabled={!weight || parseFloat(weight) <= 0}>
            {t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
