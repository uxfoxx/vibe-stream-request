import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { AuthProvider, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { searchYouTube } from "@/lib/youtube.functions";
import type { QueueItem } from "@/lib/db-types";
import { toast } from "sonner";
import { Music2, Plus, Trash2, Upload, Search, Loader2, GripVertical } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Lovable Radio" }] }),
  component: () => (
    <AuthProvider>
      <AdminGate />
    </AuthProvider>
  ),
});

function AdminGate() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading) return <CenterMsg>Loading…</CenterMsg>;
  if (!user) return null;
  if (!isAdmin) {
    return (
      <CenterMsg>
        <p>You don't have admin access.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Ask the project owner to grant your account the <code>admin</code> role
          in the <code>user_roles</code> table. Your user id: <code className="text-xs">{user.id}</code>
        </p>
        <Link to="/" className="text-primary underline mt-4 inline-block">← Back to radio</Link>
      </CenterMsg>
    );
  }
  return <AdminDashboard />;
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">{children}</div>
    </div>
  );
}

// ─── Sortable queue item ────────────────────────────────────────────────────

function SortableQueueItem({
  item, onRemove,
}: { item: QueueItem; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isPlaying = item.status === "playing";

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
      <button
        {...(isPlaying ? {} : { ...attributes, ...listeners })}
        className={`p-1 rounded ${isPlaying ? "text-muted-foreground/30 cursor-not-allowed" : "cursor-grab text-muted-foreground hover:text-foreground"}`}
        aria-label="Drag to reorder"
        tabIndex={isPlaying ? -1 : 0}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-10 w-10 rounded bg-muted overflow-hidden grid place-items-center shrink-0">
        {item.thumbnail ? <img src={item.thumbnail} alt="" className="h-full w-full object-cover" /> : <Music2 className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {isPlaying && <span className="text-primary mr-2">▶</span>}
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{item.artist} · {item.source}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={() => onRemove(item.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

// ─── Admin dashboard ────────────────────────────────────────────────────────

function AdminDashboard() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const search = useServerFn(searchYouTube);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ videoId: string; title: string; channel: string; thumbnail: string }>>([]);
  const [searching, setSearching] = useState(false);
  const reordering = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    async function load() {
      if (reordering.current) return; // don't clobber optimistic update mid-drag
      const { data } = await supabase.from("queue").select("*")
        .in("status", ["pending", "playing"])
        .order("position", { ascending: true });
      setItems((data as QueueItem[]) || []);
    }
    load();
    const ch = supabase.channel("admin-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function doSearch(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const { results: r, error } = await search({ data: { query: q } });
      if (error) toast.error(error);
      setResults(r || []);
    } finally { setSearching(false); }
  }

  async function addToQueue(r: { videoId: string; title: string; channel: string; thumbnail: string }) {
    const { error } = await supabase.from("queue").insert({
      source: "youtube",
      external_id: r.videoId,
      title: r.title,
      artist: r.channel,
      thumbnail: r.thumbnail,
      status: "pending",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Added to queue");
    await maybeStartPlayback();
  }

  async function maybeStartPlayback() {
    const { data: ps } = await supabase.from("playback_state").select("*").eq("id", 1).maybeSingle();
    if (ps?.current_queue_id) return;
    const { data: next } = await supabase.from("queue").select("*")
      .eq("status", "pending").order("position", { ascending: true }).limit(1).maybeSingle();
    if (!next) return;
    await supabase.from("queue").update({ status: "playing" }).eq("id", next.id);
    await supabase.from("playback_state").update({
      current_queue_id: next.id, started_at: new Date().toISOString(), is_playing: true,
    }).eq("id", 1);
  }

  async function removeItem(id: string) {
    await supabase.from("queue").delete().eq("id", id);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("audio").upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("audio").getPublicUrl(path);
    const { error } = await supabase.from("queue").insert({
      source: "upload",
      file_url: pub.publicUrl,
      title: file.name.replace(/\.[^.]+$/, ""),
      artist: "Upload",
      status: "pending",
    });
    if (error) toast.error(error.message);
    else { toast.success("Uploaded"); await maybeStartPlayback(); }
    e.target.value = "";
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    // Optimistic update
    setItems(reordered);
    reordering.current = true;

    const now = Date.now();
    try {
      await Promise.all(
        reordered.map(({ id }, idx) =>
          supabase.from("queue").update({ position: now + idx * 1000 }).eq("id", id)
        )
      );
    } finally {
      reordering.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Admin dashboard</h1>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Search className="h-4 w-4" /> Search YouTube</h2>
          <form onSubmit={doSearch} className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. lofi beats" />
            <Button type="submit" disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>
          {results.length > 0 && (
            <ul className="space-y-2">
              {results.map(r => (
                <li key={r.videoId} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                  <img src={r.thumbnail} alt="" className="h-12 w-12 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.channel}</p>
                  </div>
                  <Button size="sm" onClick={() => addToQueue(r)}><Plus className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Upload audio</h2>
          <Input type="file" accept="audio/*" onChange={onUpload} />
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Queue ({items.length})</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Empty.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {items.map(it => (
                    <SortableQueueItem key={it.id} item={it} onRemove={removeItem} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>
    </div>
  );
}
