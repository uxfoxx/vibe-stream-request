import { useState, type FormEvent } from "react";
import { Music2, Search, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { searchYouTube } from "@/lib/youtube.functions";
import { toast } from "sonner";

type SearchResult = { videoId: string; title: string; channel: string; thumbnail: string };

interface Props {
  triggerLabel?: string;
}

export function RequestModal({ triggerLabel }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null); // videoId being added
  const search = useServerFn(searchYouTube);

  if (!user) return null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
    }
  }

  async function doSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const { results: r, error } = await search({ data: { query: query.trim() } });
      if (error) { toast.error(error); return; }
      setResults(r || []);
    } finally {
      setSearching(false);
    }
  }

  async function addToQueue(r: SearchResult) {
    if (!user) return;
    setSubmitting(r.videoId);
    try {
      // F2: Duplicate prevention
      const { data: existing } = await supabase.from("queue")
        .select("id").eq("external_id", r.videoId).in("status", ["pending", "playing"]).maybeSingle();
      if (existing) { toast.error("This song is already in the queue"); return; }

      // F3: Request limit per user (max 2 pending)
      const { count } = await supabase.from("queue")
        .select("id", { count: "exact" }).eq("requested_by", user.id).eq("status", "pending");
      if ((count ?? 0) >= 2) { toast.error("You already have 2 songs in the queue"); return; }

      const { error } = await supabase.from("queue").insert({
        source: "youtube",
        external_id: r.videoId,
        title: r.title,
        artist: r.channel,
        thumbnail: r.thumbnail,
        requested_by: user.id,
        status: "pending",
      });
      if (error) { toast.error(error.message); return; }
      toast.success(`"${r.title}" added to queue`);
      handleOpenChange(false);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerLabel ? (
          <Button variant="ghost" size="sm" className="text-primary">
            {triggerLabel}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="rounded-full gap-1.5">
            <Music2 className="h-4 w-4" /> Request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a song</DialogTitle>
        </DialogHeader>

        <form onSubmit={doSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube for a song…"
            maxLength={200}
            autoFocus
          />
          <Button type="submit" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {/* Skeleton loading state */}
        {searching && (
          <ul className="space-y-2 mt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-12 w-12 rounded shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Results */}
        {!searching && results.length > 0 && (
          <ul className="space-y-1 max-h-72 overflow-auto mt-1">
            {results.map((r) => (
              <li key={r.videoId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <img src={r.thumbnail} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.channel}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => addToQueue(r)}
                  disabled={submitting === r.videoId}
                >
                  {submitting === r.videoId
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Plus className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state after search */}
        {!searching && results.length === 0 && query && (
          <p className="text-sm text-muted-foreground text-center py-4">No results. Try a different search.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
