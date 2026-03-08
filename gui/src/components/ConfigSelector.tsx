import { open } from '@tauri-apps/plugin-dialog';
import { ConfigPathSelector } from '@fileuni/shared';
import { safeInvoke } from '../lib/tauri';

interface ConfigSelectorProps {
  isOpen: boolean;
  onRuntimeDirsSelected: (configDir: string, appDataDir: string) => void;
  onClose: () => void;
  canClose?: boolean;
}

export default function ConfigSelector({
  isOpen,
  onRuntimeDirsSelected,
  onClose,
  canClose = true,
}: ConfigSelectorProps) {
  const ensureNativeDialogReady = async () => {
    const ready = await safeInvoke<boolean>('prepare_native_file_dialog');
    if (!ready) {
      throw new Error('Native file dialog is unavailable. Please enter the run data directory manually.');
    }
  };

  return (
    <ConfigPathSelector
      isOpen={isOpen}
      onClose={onClose}
      canClose={canClose}
      onBrowsePath={async (_target) => {
        await ensureNativeDialogReady();
        const selected = await open({
          directory: true,
          multiple: false,
        });
        return typeof selected === 'string' ? selected : null;
      }}
      onValidatePath={async (value) => {
        try {
          const valid = await safeInvoke<boolean>('validate_runtime_dirs', {
            config_dir: value.configDir,
            app_data_dir: value.appDataDir,
          });
          return { valid };
        } catch (errorValue: unknown) {
          return {
            valid: false,
            error: errorValue instanceof Error ? errorValue.message : String(errorValue),
          };
        }
      }}
      onPreparePath={async () => undefined}
      onConfirmPath={async (value) => {
        onRuntimeDirsSelected(value.configDir, value.appDataDir);
      }}
    />
  );
}
