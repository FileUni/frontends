import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button.tsx";
import { useFileStore } from "../store/useFileStore.ts";

export const FileManagerRecentStats = ({ onClear }: { onClear: () => void }) => {
  const { t } = useTranslation();
  const { files } = useFileStore();

  return (
    <div className="px-6 py-3 bg-primary/5 border-b border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="px-3 py-1 bg-primary text-white rounded-full text-sm font-black">
          {files.length} / 100
        </div>
        <p className="text-sm font-bold opacity-40 uppercase tracking-wider">
          {t("filemanager.recentRules") || "History covers: directory browsing, property checks, previews, and downloads."}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="h-9 text-sm font-black uppercase text-red-400 hover:text-red-500 hover:bg-red-500/10" onClick={onClear}>
        {t("filemanager.actions.clearHistory") || "Clear All"}
      </Button>
    </div>
  );
};
