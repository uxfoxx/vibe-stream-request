import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { Queue } from "@/components/Queue";
import { History } from "@/components/History";
import { Chat } from "@/components/Chat";
import { MiniPlayer } from "@/components/MiniPlayer";
import { AuthProvider } from "@/lib/auth";
import { PlaybackProvider, usePlayback } from "@/lib/playback-context";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

  // Sidebar visible-by-default on desktop, hidden on mobile (overlay when opened)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<string>("now");

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const showSidebar = sidebarOpen;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar onToggleSidebar={() => setSidebarOpen(s => !s)} />

      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar — fixed overlay on mobile, inline on desktop */}
        {isMobile ? (
          <>
            {showSidebar && (
              <div
                className="fixed inset-0 top-14 z-30 bg-black/50"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <div
              className={`fixed top-14 bottom-0 left-0 z-40 transition-transform ${
                showSidebar ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <Sidebar
                collapsed={false}
                onNavigate={() => setSidebarOpen(false)}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
              />
            </div>
          </>
        ) : (
          showSidebar && (
            <Sidebar
              collapsed={false}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          )
        )}

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <h1 className="sr-only">Lovable Radio</h1>
          <div className="max-w-[1800px] mx-auto p-3 sm:p-5 lg:p-6">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6">
              {/* Primary column: player + queue + history */}
              <div className="space-y-4 lg:space-y-6 min-w-0">
                <Player />
                <Queue />
                <History />
              </div>

              {/* Right rail: chat (YouTube-like related/chat panel) */}
              <aside className="min-w-0">
                <div className="xl:sticky xl:top-[72px]">
                  <Chat />
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>

      <MiniPlayer hasJoined={hasJoined} muted={muted} setMuted={setMuted} joinAndPlay={joinAndPlay} />
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
