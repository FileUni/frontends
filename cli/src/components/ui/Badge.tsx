import React from 'react';
import { cn } from '@/lib/utils.ts';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'error' | 'ghost';

export const Badge = ({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: BadgeVariant }) => {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-primary text-white border-transparent',

    secondary: 'bg-muted text-muted-foreground border-transparent',
    destructive: 'bg-destructive text-destructive-foreground border-transparent',
    outline: 'bg-background text-foreground border-border',
    success: 'bg-green-500/10 text-green-500 border-green-500/20',
    warning: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    error: 'bg-red-500/10 text-red-500 border-red-500/20',
    ghost: 'bg-white/5 text-white/50 border-white/10'
  };

  return (
    <span className={cn(
      'px-2.5 py-0.5 rounded-full text-sm font-black uppercase tracking-wider border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};
