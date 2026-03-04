import { Button } from '@/components/ui/Button.tsx';
import { useTranslation } from 'react-i18next';
import type { ServiceStatus, ToolInfo } from './types.ts';

type Props = {
  tools: ToolInfo[];
  serviceMap: Record<string, ServiceStatus>;
  installingTool: string;
  installLabel: string;
  installingLabel: string;
  installedLabel: string;
  notInstalledLabel: string;
  startLabel: string;
  stopLabel: string;
  restartLabel: string;
  onInstall: (tool: string) => void;
  onControlService: (tool: string, action: 'start' | 'stop' | 'restart') => void;
};

export const ToolCardsPanel = (props: Props) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {props.tools.map((tool) => (
        <div key={tool.name} className="rounded-3xl border border-white/10 bg-black/40 p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xl font-black uppercase tracking-tight">{tool.name}</div>
              <div className="text-sm font-mono opacity-50 break-all">{tool.executable_path}</div>
              <div className="text-sm font-bold mt-2 flex items-center gap-2">
                <span className={props.serviceMap[tool.name]?.running ? 'text-emerald-400' : 'text-zinc-500'}>
                  {props.serviceMap[tool.name]?.running
                    ? `${t('admin.extensions.serviceRunning')} (PID: ${props.serviceMap[tool.name]?.pid ?? '-'})`
                    : t('admin.extensions.serviceStopped')}
                </span>
              </div>
              <div className="text-sm opacity-40 uppercase font-black tracking-widest">
                {t('admin.extensions.followStart')}: {props.serviceMap[tool.name]?.follow_start ? t('common.on') : t('common.off')}
              </div>
            </div>
            <span className={`text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full ${tool.installed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/20'}`}>
              {tool.installed ? props.installedLabel : props.notInstalledLabel}
            </span>
          </div>
          <div className="space-y-3">
            <Button size="lg" onClick={() => props.onInstall(tool.name)} disabled={props.installingTool.length > 0} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-sm">
              {props.installingTool === tool.name ? props.installingLabel : props.installLabel}
            </Button>
            <div className="grid grid-cols-3 gap-3">
              <Button size="sm" variant="outline" className="h-10 rounded-xl font-bold text-[14px] uppercase" onClick={() => props.onControlService(tool.name, 'start')}>{props.startLabel}</Button>
              <Button size="sm" variant="outline" className="h-10 rounded-xl font-bold text-[14px] uppercase" onClick={() => props.onControlService(tool.name, 'stop')}>{props.stopLabel}</Button>
              <Button size="sm" variant="outline" className="h-10 rounded-xl font-bold text-[14px] uppercase" onClick={() => props.onControlService(tool.name, 'restart')}>{props.restartLabel}</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
