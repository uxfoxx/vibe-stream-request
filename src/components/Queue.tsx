import { useEffect, useState } from "react";
import { Music2, ListMusic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { QueueItem, Profile } from "@/lib/db-types";

export function Queue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("queue").select("*").eq("status", "pending")
        .order("position", { ascending: true }).limit(20);
      setItems((data as QueueItem[]) || []);
    }
    load();
    const ch = supabase.channel("queue-public")
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

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        <ListMusic className="h-4 w-4" /> Up next ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Queue is empty. Request a song in chat!</p>
      ) : (
        <ul className="space-y-2 max-h-[400px] overflow-auto">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 grid place-items-center">
                {it.thumbnail ? <img src={it.thumbnail} alt="" className="h-full w-full object-cover" /> : <Music2 className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{it.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {it.artist || (it.source === "youtube" ? "YouTube" : "Upload")}
                  {it.requested_by && profiles[it.requested_by] && (
                    <> · 🎵 by @{profiles[it.requested_by].username}</>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
