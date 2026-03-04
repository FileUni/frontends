import React, { useState, useRef, useEffect } from "react";
import { HardDrive, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { cn } from "@/lib/utils.ts";
import { useFileStore } from "../store/useFileStore.ts";

export const FileManagerNavigationBar = () => {
  const store = useFileStore();
  const currentPath = store.getCurrentPath();
  const setCurrentPath = store.setCurrentPath;

  const [isEditMode, setIsEditMode] = useState(false);
  const [pathInput, setPathInput] = useState(currentPath);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (isEditMode) {
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
    }
  }, [isEditMode]);

  const pathSegments = currentPath.split("/").filter(Boolean);
  
  const navigateTo = (index: number) => {
    const newPath = "/" + pathSegments.slice(0, index + 1).join("/");
    setCurrentPath(newPath);
  };

  const handleAddressSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    let targetPath = pathInput.trim();
    if (!targetPath && !targetPath.startsWith("/")) targetPath = "/" + targetPath;
    if (targetPath === "") targetPath = "/";
    setCurrentPath(targetPath);
    setIsEditMode(false);
  };

  return (
    <div className="px-6 py-2 bg-white/[0.02] flex items-center gap-3 border-b border-white/5 shrink-0">
      <div className={cn(
        "flex-1 h-9 rounded-xl flex items-center px-3 transition-all relative overflow-hidden",
        isEditMode ? "bg-white/10 border border-primary/30" : "hover:bg-white/5 border border-transparent cursor-text"
      )} onClick={() => !isEditMode && setIsEditMode(true)}>
        {!isEditMode ? (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar font-bold text-sm w-full h-full">
            <Button variant="ghost" className="p-1.5 h-9 rounded-lg text-primary/60 hover:text-primary shrink-0" onClick={(e) => { e.stopPropagation(); setCurrentPath("/"); }}>
              <HardDrive size={18} />
            </Button>
            {pathSegments.length > 4 && (
              <><span className="opacity-10 shrink-0">/</span><span className="px-1 opacity-40 font-black">...</span></>
            )}
            {pathSegments.map((segment, i) => {
              if (pathSegments.length > 4 && i < pathSegments.length - 4) return null;
              return (
                <React.Fragment key={i}>
                  <span className="opacity-10 shrink-0">/</span>
                  <Button variant="ghost" className="px-2 h-9 rounded-lg whitespace-nowrap shrink-0 opacity-60 hover:opacity-100 max-w-[120px]" onClick={(e) => { e.stopPropagation(); navigateTo(i); }}>
                    <span className="truncate">{segment}</span>
                  </Button>
                </React.Fragment>
              );
            })}
            <div className="flex-1 h-full min-w-[20px]" />
          </div>
        ) : (
          <form onSubmit={handleAddressSubmit} className="flex items-center w-full gap-2">
            <Input ref={addressInputRef} className="bg-transparent border-none p-0 h-full text-sm font-mono focus-visible:ring-0 focus-visible:ring-offset-0" value={pathInput} onChange={(e) => setPathInput(e.target.value)} onBlur={() => setTimeout(() => setIsEditMode(false), 200)} />
            <button type="submit" className="p-1 rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors">
              <ArrowRight size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
