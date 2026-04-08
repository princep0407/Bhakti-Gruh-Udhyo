import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

interface SearchableSelectProps {
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  emptyMessage?: string;
}

export function SearchableSelect({
  options,
  value,
  onSelect,
  placeholder,
  searchPlaceholder,
  className,
  emptyMessage
}: SearchableSelectProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full h-12 justify-between bg-white/50 border-slate-200 hover:bg-white/80 transition-all",
          className
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {value ? t(value) : (placeholder || t('select_item'))}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 glass border-slate-200 shadow-xl" align="start">
        <div className="p-2 border-b border-slate-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={searchPlaceholder || t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 border-none focus-visible:ring-0 bg-transparent"
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">{emptyMessage || t('no_records')}</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md transition-colors text-left",
                  value === option
                    ? "bg-primary text-white font-bold"
                    : "text-slate-700 hover:bg-primary/10"
                )}
              >
                {t(option)}
                {value === option && <Check className="h-4 w-4" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
