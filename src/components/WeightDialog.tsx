import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
          <DialogTitle className="text-xl font-bold text-primary">વજન ઉમેરો</DialogTitle>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-600">વસ્તુ: <span className="font-bold text-slate-900">{itemName}</span></Label>
            {stock !== undefined && (
              <div className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold inline-block">
                સ્ટોક: {stock} {unit}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-weight" className="text-slate-600 font-medium">વજન (કિલો/ગ્રામ)</Label>
            <Input
              id="item-weight"
              type="number"
              step="0.001"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="વજન લખો..."
              className="h-12 bg-white/50 border-slate-200 focus:ring-primary/20"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-12">રદ કરો</Button>
          <Button onClick={handleConfirm} className="h-12 px-8 font-bold" disabled={!weight || parseFloat(weight) <= 0}>
            ઉમેરો
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
