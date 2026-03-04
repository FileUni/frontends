import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      remove: (widgetId: string) => void;
    };
    __turnstileOnLoad?: () => void;
  }
}

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

type TurnstileWidgetProps = {
  siteKey: string;
  onTokenChange: (token: string) => void;
};

let scriptPromise: Promise<void> | null = null;

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    window.__turnstileOnLoad = () => resolve();

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__turnstileOnLoad";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function TurnstileWidget({ siteKey, onTokenChange }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const setupWidget = async () => {
      try {
        await ensureTurnstileScript();
        if (disposed || !containerRef.current || !window.turnstile) {
          return;
        }

        onTokenChange("");
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onTokenChange(token),
          "expired-callback": () => onTokenChange(""),
          "error-callback": () => onTokenChange(""),
        });
      } catch (_e) {
        onTokenChange("");
      }
    };

    setupWidget();

    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, onTokenChange]);

  return <div ref={containerRef} />;
}

