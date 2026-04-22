import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Radio, MessageSquare } from "lucide-react";
import { Header } from "@/components/Header";
import { Player } from "@/components/Player";
import { Queue } from "@/components/Queue";
import { History } from "@/components/History";
import { Chat } from "@/components/Chat";
import { MiniPlayer } from "@/components/MiniPlayer";
import { AuthProvider } from "@/lib/auth";
import { PlaybackProvider, usePlayback } from "@/lib/playback-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lovable Radio — Listen live" },
      { name: "description", content: "A live web radio with synced playback, chat, and song requests." },
      { property: "og:title", content: "Lovable Radio" },
      { property: "og:description", content: "Live web radio with chat and song requests." },
    ],
  }),
  component: Index,
});

function RadioPage() {
  const { hasJoined, muted, setMuted, joinAndPlay } = usePlayback();
  // "radio" tab shows Player+Queue+History; "chat" tab shows Chat — mobile only
  const [mobileTab, setMobileTab] = useState<"radio" | "chat">("radio");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 pb-20 lg:py-6 lg:pb-6">
        {/*
          Each component is rendered EXACTLY ONCE.
          On mobile:  toggled via mobileTab state (hidden = display:none, component stays mounted)
          On desktop: both columns always visible via lg:block override
        */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Left column: Player + Queue + History */}
          <div
            className={`lg:col-span-2 space-y-4 sm:space-y-6 ${
              mobileTab === "chat" ? "hidden lg:block" : ""
            }`}
          >
            <Player />
            <Queue />
            <History />
          </div>

          {/* Right column: Chat */}
          <div
            className={`lg:col-span-1 mt-4 lg:mt-0 ${
              mobileTab === "radio" ? "hidden lg:block" : ""
            }`}
          >
            <Chat />
          </div>
        </div>
      </main>

      {/* Desktop-only sticky mini-player */}
      <MiniPlayer hasJoined={hasJoined} muted={muted} setMuted={setMuted} joinAndPlay={joinAndPlay} />

      {/* Mobile bottom tab bar (hidden on lg+) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-14">
          <button
            onClick={() => setMobileTab("radio")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              mobileTab === "radio" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Radio className="h-5 w-5" />
            <span>Radio</span>
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              mobileTab === "chat" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            <span>Chat</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function Index() {
  return (
    <AuthProvider>
      <PlaybackProvider>
        <RadioPage />
      </PlaybackProvider>
    </AuthProvider>
  );
}
