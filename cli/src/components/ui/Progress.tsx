import { cn } from '@/lib/utils.ts';

export const Progress = ({ value, max = 100, className, barClassName }: { value: number, max?: number, className?: string, barClassName?: string }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div className={cn("w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner", className)}>
      <div 
        className={cn("h-full bg-primary rounded-full transition-all duration-1000 ease-out", barClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
