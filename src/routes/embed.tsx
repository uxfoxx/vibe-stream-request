import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Player } from "@/components/Player";
import { AuthProvider } from "@/lib/auth";
import { PlaybackProvider } from "@/lib/playback-context";

export const Route = createFileRoute("/embed")({
  validateSearch: (search: Record<string, unknown>) => ({
    theme: (search.theme as string) === "light" ? "light" : "dark",
  }),
  head: () => ({
    meta: [
      { title: "Lovable Radio — Embed" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmbedPage,
});

function EmbedPage() {
  const { theme } = useSearch({ from: "/embed" });

  return (
    <AuthProvider>
      <PlaybackProvider>
        <div className={theme} style={{ minHeight: "unset" }}>
          <div className="bg-background p-4">
            <Player />
          </div>
        </div>
      </PlaybackProvider>
    </AuthProvider>
  );
}
