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
      <main className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="sr-only">Lovable Radio</h1>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Player />
            <Queue />
            <History />
          </div>
          <div className="lg:col-span-1">
            <Chat />
          </div>
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
