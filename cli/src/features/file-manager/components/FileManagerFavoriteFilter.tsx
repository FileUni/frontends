import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { useFileStore } from "../store/useFileStore.ts";

const FAVORITE_COLORS = [
  { id: 1, name: 'Red', class: 'bg-red-500' },
  { id: 2, name: 'Orange', class: 'bg-orange-500' },
  { id: 3, name: 'Yellow', class: 'bg-yellow-500' },
  { id: 4, name: 'Green', class: 'bg-green-500' },
  { id: 5, name: 'Blue', class: 'bg-blue-500' },
  { id: 6, name: 'Cyan', class: 'bg-cyan-500' },
  { id: 7, name: 'Deep Blue', class: 'bg-blue-700' },
];

export const FileManagerFavoriteFilter = () => {
  const { t } = useTranslation();
  const { favoriteFilterColor, setFavoriteFilterColor } = useFileStore();

  return (
    <div className="px-6 py-2 bg-white/[0.01] border-b border-white/5 flex items-center gap-4 overflow-x-auto no-scrollbar shrink-0">
      <p className="text-sm font-black uppercase opacity-30 tracking-widest shrink-0">
        {t("filemanager.filterByColor") || "Filter by Color"}
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => setFavoriteFilterColor(null)} className={cn("px-3 py-1 rounded-full text-sm font-black uppercase transition-all border", favoriteFilterColor === null ? "bg-primary text-white border-primary" : "bg-white/5 border-white/5 opacity-40 hover:opacity-100")}>
          {t("common.all")}
        </button>
        {FAVORITE_COLORS.map((color) => (
          <button key={color.id} onClick={() => setFavoriteFilterColor(color.id)} className={cn("flex items-center gap-2 px-3 py-1 rounded-full text-sm font-black uppercase transition-all border", favoriteFilterColor === color.id ? "bg-white/10 border-primary text-primary" : "bg-white/5 border-white/5 opacity-40 hover:opacity-100")}>
            <div className={cn("w-2 h-2 rounded-full shadow-sm", color.class)} />
          </button>
        ))}
      </div>
    </div>
  );
};
