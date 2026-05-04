import { createFileRoute } from "@tanstack/react-router";
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

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6">
        <h1 className="sr-only">Lovable Radio</h1>

        {/* YouTube-style watch layout:
            - Top row: Player (left, primary) + Chat (right rail)
            - Bottom row (under player): Up Next, then History
            On mobile everything stacks: Player → Chat → Up Next → History */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] gap-4 lg:gap-6">
          {/* Left column: player + what's next */}
          <div className="min-w-0 space-y-4 lg:space-y-6 order-1">
            <Player />
            <Queue />
            <History />
          </div>

          {/* Right column: live chat (sticky on desktop, like YT chat) */}
          <aside className="min-w-0 order-2">
            <div className="lg:sticky lg:top-20">
              <Chat />
            </div>
          </aside>
        </div>
      </main>
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
