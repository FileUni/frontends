import { invoke } from '@tauri-apps/api/core';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { ConfigPathSelector } from '@fileuni/shared';

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
    const ready = await invoke<boolean>('prepare_native_file_dialog');
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
          const valid = await invoke<boolean>('validate_runtime_dirs', {
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
      onPreparePath={async (value) => {
        const ready = await invoke<boolean>('validate_or_prepare_runtime_dirs', {
          config_dir: value.configDir,
          app_data_dir: value.appDataDir,
          auto_create: false,
        });
        if (!ready) {
          const accepted = await ask('Selected directories are unavailable or incomplete. Create directories and default config.toml now?', {
            title: 'Initialize Runtime Directories',
            kind: 'info',
          });
          if (!accepted) {
            throw new Error('Runtime directories initialization was declined.');
          }
          const initialized = await invoke<boolean>('validate_or_prepare_runtime_dirs', {
            config_dir: value.configDir,
            app_data_dir: value.appDataDir,
            auto_create: true,
          });
          if (!initialized) {
            throw new Error('Failed to initialize runtime directories.');
          }
        }
      }}
      onConfirmPath={async (value) => {
        onRuntimeDirsSelected(value.configDir, value.appDataDir);
      }}
    />
  );
}
