import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { useTranslation } from 'react-i18next';
import type { CmdResult } from './types.ts';

type Props = {
  title: string;
  runLabel: string;
  toolNames: string[];
  commandTool: string;
  setCommandTool: (value: string) => void;
  commandArgs: string;
  setCommandArgs: (value: string) => void;
  cmdResult: CmdResult | null;
  onRun: () => void;
};

export const CommandPanel = (props: Props) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 space-y-8 shadow-2xl">
      <h4 className="text-xl font-black uppercase tracking-widest opacity-60">{props.title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <select
          className="h-14 rounded-2xl border border-white/10 bg-black/20 px-4 text-base font-bold focus:ring-4 focus:ring-primary/20 transition-all outline-none"
          value={props.commandTool}
          onChange={(e) => props.setCommandTool(e.target.value)}
        >
          {props.toolNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="md:col-span-2">
          <Input 
            value={props.commandArgs} 
            onChange={(e) => props.setCommandArgs(e.target.value)} 
            placeholder={t('admin.extensions.commandArgsPlaceholder')} 
            className="h-14 rounded-2xl bg-white/5 border-white/5 text-base px-6"
          />
        </div>
        <Button 
          onClick={props.onRun} 
          className="h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 transition-all active:scale-95"
          variant="primary"
        >
          {props.runLabel}
        </Button>
      </div>

      {props.cmdResult && (
        <div className="rounded-[2rem] border border-white/10 p-6 space-y-6 text-base font-mono bg-black/40 shadow-inner">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black uppercase opacity-40 tracking-widest">{t('admin.extensions.exitCode')}:</span>
            <span className={`px-3 py-1 rounded-lg font-bold ${props.cmdResult.code === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{props.cmdResult.code}</span>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-black uppercase opacity-40 tracking-widest">{t('admin.extensions.stdout')}</div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <pre className="whitespace-pre-wrap break-words opacity-80 text-sm leading-relaxed">{props.cmdResult.stdout || <span className="opacity-20 italic">No output</span>}</pre>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-black uppercase opacity-40 tracking-widest">{t('admin.extensions.stderr')}</div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <pre className="whitespace-pre-wrap break-words text-red-400/80 text-sm leading-relaxed">{props.cmdResult.stderr || <span className="opacity-20 italic">No error output</span>}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
