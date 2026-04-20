import { createContext, useContext, useState, type ReactNode } from "react";

interface PlaybackContextValue {
  hasJoined: boolean;
  muted: boolean;
  setMuted: (m: boolean | ((prev: boolean) => boolean)) => void;
  joinAndPlay: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | undefined>(undefined);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [hasJoined, setHasJoined] = useState(false);
  const [muted, setMuted] = useState(true);

  function joinAndPlay() {
    setHasJoined(true);
    setMuted(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("pause", () => {});
      navigator.mediaSession.setActionHandler("stop", () => {});
    }
  }

  return (
    <PlaybackContext.Provider value={{ hasJoined, muted, setMuted, joinAndPlay }}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used inside PlaybackProvider");
  return ctx;
}
