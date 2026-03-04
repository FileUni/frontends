import React from 'react';
import { cn } from '@/lib/utils.ts';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, value, onChange, ...props }, ref) => {
  return (
    <input
      ref={ref}
      value={value ?? ''}
      onChange={onChange}
      className={cn(
        'w-full h-12 px-4 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:font-normal text-base text-foreground',
        className
      )}
      {...props}
    />
  );
});
