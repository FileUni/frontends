import React from 'react';
import { cn } from '@/lib/utils.ts';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { 
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>(({ className, variant = 'primary', size = 'md', ...props }, ref) => {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95',

    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600 hover:scale-[1.02] active:scale-95'
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-xl',
    md: 'px-6 py-3 text-sm rounded-2xl',
    lg: 'px-8 py-4 text-base rounded-[1.25rem]',
    icon: 'p-2 rounded-xl'
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-black transition-all disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
