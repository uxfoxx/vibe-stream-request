import { useEffect, useState } from "react";
import { Music2, History as HistoryIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { QueueItem, Profile } from "@/lib/db-types";

export function History() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("queue")
        .select("*")
        .eq("status", "played")
        .order("created_at", { ascending: false })
        .limit(10);
      setItems((data as QueueItem[]) || []);
    }
    load();
    const chName = `queue-history-${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(chName)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const ids = Array.from(new Set(items.map(i => i.requested_by).filter(Boolean))) as string[];
    const missing = ids.filter(id => !profiles[id]);
    if (!missing.length) return;
    supabase.from("profiles").select("*").in("id", missing).then(({ data }) => {
      if (!data) return;
      setProfiles(p => {
        const next = { ...p };
        for (const pr of data as Profile[]) next[pr.id] = pr;
        return next;
      });
    });
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        <HistoryIcon className="h-4 w-4" /> Recently played ({items.length})
      </div>
      <ul className="space-y-2 max-h-[300px] overflow-auto">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 opacity-75">
            <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 grid place-items-center">
              {it.thumbnail
                ? <img src={it.thumbnail} alt="" className="h-full w-full object-cover grayscale" />
                : <Music2 className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-muted-foreground">{it.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs text-muted-foreground truncate">
                  {it.artist || (it.source === "youtube" ? "YouTube" : "Upload")}
                </p>
                {it.requested_by && profiles[it.requested_by] && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 shrink-0">
                    @{profiles[it.requested_by].username}
                  </Badge>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
