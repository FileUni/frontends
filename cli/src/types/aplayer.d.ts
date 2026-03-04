declare module 'aplayer' {
  interface APlayerAudioItem {
    name?: string;
    url: string;
    artist?: string;
    cover?: string;
    lrc?: string;
    type?: string;
  }

  interface APlayerOptions {
    container: HTMLElement;
    audio: APlayerAudioItem[];
    [key: string]: unknown;
  }

  interface APlayerInstance {
    play: () => void;
    pause: () => void;
    destroy: () => void;
    seek?: (seconds: number) => void;
    list?: {
      audios: APlayerAudioItem[];
      index: number;
      switch: (index: number) => void;
    };
    audio?: HTMLAudioElement;
    on?: (event: string, callback: (...args: unknown[]) => void) => void;
  }

  interface APlayerConstructor {
    new (options: APlayerOptions): APlayerInstance;
  }

  const APlayer: APlayerConstructor;
  export default APlayer;
}
