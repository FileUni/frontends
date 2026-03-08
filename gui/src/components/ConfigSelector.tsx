import { open } from '@tauri-apps/plugin-dialog';
import { ConfigPathSelector, type RuntimeDirsValue } from '@fileuni/shared';
import { safeInvoke } from '../lib/tauri';

interface RuntimeDirPresets {
  current_config_dir: string;
  current_app_data_dir: string;
  default_config_dir: string;
  default_app_data_dir: string;
}

interface ConfigSelectorProps {
  isOpen: boolean;
  onRuntimeDirsSelected: (configDir: string, appDataDir: string) => void;
  onClose: () => void;
  canClose?: boolean;
  currentValue?: RuntimeDirsValue;
  presets: RuntimeDirPresets | null;
}

export default function ConfigSelector({
  isOpen,
  onRuntimeDirsSelected,
  onClose,
  canClose = true,
  currentValue,
  presets,
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
      initialValue={currentValue}
      currentPreset={presets ? {
        configDir: presets.current_config_dir,
        appDataDir: presets.current_app_data_dir,
      } : undefined}
      defaultPreset={presets ? {
        configDir: presets.default_config_dir,
        appDataDir: presets.default_app_data_dir,
      } : undefined}
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
            configDir: value.configDir,
            appDataDir: value.appDataDir,
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
