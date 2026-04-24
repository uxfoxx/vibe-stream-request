import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { AuthProvider, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { searchYouTube } from "@/lib/youtube.functions";
import type { QueueItem, Profile, WordFilter, ScheduledPlaylist } from "@/lib/db-types";
import { toast } from "sonner";
import {
  Music2, Plus, Trash2, Upload, Search, Loader2, GripVertical,
  Users, Filter, BarChart2, Calendar, Shield,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";

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

// ─── Tab definitions ─────────────────────────────────────────────────────────

type Tab = "queue" | "users" | "wordfilter" | "analytics" | "schedule";

// ─── Admin dashboard ─────────────────────────────────────────────────────────

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("queue");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "queue", label: "Queue", icon: <Music2 className="h-4 w-4" /> },
    { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { id: "wordfilter", label: "Word Filter", icon: <Filter className="h-4 w-4" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart2 className="h-4 w-4" /> },
    { id: "schedule", label: "Schedule", icon: <Calendar className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-5 w-5" /> Admin dashboard</h1>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === "queue" && <QueueTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "wordfilter" && <WordFilterTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "schedule" && <ScheduleTab />}
      </div>
    </div>
  );
}

// ─── Queue Tab ───────────────────────────────────────────────────────────────

function QueueTab() {
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
      if (reordering.current) return;
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
    // Atomic, race-safe: passing null only advances when state is idle.
    await (supabase.rpc as any)("advance_queue", { expected_current: null });
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
    <div className="space-y-6">
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
  );
}

// ─── Users Tab (F6 + F25) ────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<Profile[]>([]);

  async function load() {
    const { data } = await supabase.from("profiles")
      .select("*").order("created_at", { ascending: false });
    setUsers((data as Profile[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function setBan(userId: string, type: "10min" | "1hr" | "24hr" | "permanent" | "unban") {
    if (type === "unban") {
      const { error } = await supabase.from("profiles")
        .update({ banned: false, temp_ban_until: null, ban_reason: null }).eq("id", userId);
      if (error) toast.error(error.message);
      else { toast.success("User unbanned"); load(); }
      return;
    }
    if (type === "permanent") {
      const { error } = await supabase.from("profiles")
        .update({ banned: true, ban_reason: "Permanent ban" }).eq("id", userId);
      if (error) toast.error(error.message);
      else { toast.success("User permanently banned"); load(); }
      return;
    }
    const durations: Record<string, number> = { "10min": 10, "1hr": 60, "24hr": 1440 };
    const minutes = durations[type];
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const { error } = await supabase.from("profiles")
      .update({ temp_ban_until: until, ban_reason: `Timed out for ${type}` }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success(`User timed out for ${type}`); load(); }
  }

  const isBanned = (u: Profile) => u.banned || (u.temp_ban_until != null && new Date(u.temp_ban_until) > new Date());

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Users &amp; Moderation</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 pr-4">User</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Joined</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map(u => (
              <tr key={u.id}>
                <td className="py-2 pr-4">
                  <span className="font-medium">@{u.username}</span>
                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{u.id.slice(0, 8)}…</span>
                </td>
                <td className="py-2 pr-4">
                  {u.banned ? (
                    <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">Banned</span>
                  ) : u.temp_ban_until && new Date(u.temp_ban_until) > new Date() ? (
                    <span className="text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded">
                      Timeout until {new Date(u.temp_ban_until).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Active</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-muted-foreground text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="py-2">
                  {isBanned(u) ? (
                    <Button size="sm" variant="outline" onClick={() => setBan(u.id, "unban")}>Unban</Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">Ban…</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setBan(u.id, "10min")}>Timeout 10 min</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBan(u.id, "1hr")}>Timeout 1 hour</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBan(u.id, "24hr")}>Timeout 24 hours</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBan(u.id, "permanent")} className="text-destructive">
                          Permanent ban
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Word Filter Tab (F24) ────────────────────────────────────────────────────

function WordFilterTab() {
  const [filters, setFilters] = useState<WordFilter[]>([]);
  const [newWord, setNewWord] = useState("");

  async function load() {
    const { data } = await supabase.from("word_filters").select("*").order("word");
    setFilters((data as WordFilter[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function addWord() {
    const w = newWord.trim().toLowerCase();
    if (!w) return;
    const { error } = await supabase.from("word_filters").insert({ word: w });
    if (error) { toast.error(error.code === "23505" ? "Word already exists" : error.message); return; }
    setNewWord("");
    load();
  }

  async function removeWord(id: string) {
    await supabase.from("word_filters").delete().eq("id", id);
    load();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><Filter className="h-4 w-4" /> Word Filter</h2>
      <p className="text-sm text-muted-foreground">Messages containing these words will be blocked.</p>
      <div className="flex gap-2">
        <Input
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          placeholder="e.g. spam"
          onKeyDown={e => e.key === "Enter" && addWord()}
          maxLength={50}
        />
        <Button onClick={addWord} disabled={!newWord.trim()}>Add</Button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {filters.map(f => (
          <li key={f.id} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm">
            {f.word}
            <button onClick={() => removeWord(f.id)} className="ml-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
        {filters.length === 0 && <p className="text-sm text-muted-foreground">No filters yet.</p>}
      </ul>
    </section>
  );
}

// ─── Analytics Tab (F26) ─────────────────────────────────────────────────────

function AnalyticsTab() {
  const [topSongs, setTopSongs] = useState<{ title: string; count: number }[]>([]);
  const [msgsByHour, setMsgsByHour] = useState<{ hour: string; count: number }[]>([]);
  const [stats, setStats] = useState({ totalPlayed: 0, totalRequested: 0 });

  useEffect(() => {
    // Most requested songs
    supabase.from("queue").select("title").neq("title", "").then(({ data }) => {
      if (!data) return;
      const counts: Record<string, number> = {};
      for (const r of data) counts[r.title] = (counts[r.title] ?? 0) + 1;
      const sorted = Object.entries(counts)
        .map(([title, count]) => ({ title: title.slice(0, 24), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setTopSongs(sorted);
    });

    // Queue stats
    Promise.all([
      supabase.from("queue").select("id", { count: "exact" }).eq("status", "played"),
      supabase.from("queue").select("id", { count: "exact" }).not("requested_by", "is", null),
    ]).then(([played, requested]) => {
      setStats({ totalPlayed: played.count ?? 0, totalRequested: requested.count ?? 0 });
    });

    // Messages per hour today (last 24h)
    supabase.from("messages")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .eq("type", "chat")
      .then(({ data }) => {
        if (!data) return;
        const byHour: Record<number, number> = {};
        for (const m of data) {
          const h = new Date(m.created_at).getHours();
          byHour[h] = (byHour[h] ?? 0) + 1;
        }
        const hours = Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}:00`,
          count: byHour[i] ?? 0,
        }));
        setMsgsByHour(hours);
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Songs played", value: stats.totalPlayed },
          { label: "User requests", value: stats.totalRequested },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Most requested songs */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Most played songs</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={topSongs} layout="vertical" margin={{ left: 8 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="title" width={160} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Messages per hour */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Chat activity (last 24h)</h2>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={msgsByHour}>
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

// ─── Schedule Tab (F27) ───────────────────────────────────────────────────────

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ScheduleTab() {
  const [playlists, setPlaylists] = useState<ScheduledPlaylist[]>([]);
  const [name, setName] = useState("");
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(20);
  const [urlsInput, setUrlsInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("scheduled_playlists").select("*").order("day_of_week").order("start_hour");
    setPlaylists((data as ScheduledPlaylist[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    const urls = urlsInput.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    const items = urls.map(url => {
      const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      const videoId = match ? match[1] : url;
      return { videoId, title: videoId, channel: "", thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` };
    });
    setSaving(true);
    const { error } = await supabase.from("scheduled_playlists").insert({
      name: name.trim(), day_of_week: day, start_hour: hour, items, active: true,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    setName(""); setUrlsInput(""); setSaving(false);
    load();
    toast.success("Scheduled playlist created");
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from("scheduled_playlists").update({ active: !active }).eq("id", id);
    load();
  }

  async function deletePlaylist(id: string) {
    await supabase.from("scheduled_playlists").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Create scheduled playlist</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Playlist name" />
          <select
            value={day}
            onChange={e => setDay(parseInt(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={e => setHour(parseInt(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">:00</span>
          </div>
        </div>
        <textarea
          value={urlsInput}
          onChange={e => setUrlsInput(e.target.value)}
          placeholder="YouTube URLs or video IDs, one per line"
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button onClick={create} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Create
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Scheduled playlists ({playlists.length})</h2>
        {playlists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scheduled playlists yet.</p>
        ) : (
          <ul className="space-y-2">
            {playlists.map(p => (
              <li key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {DAYS[p.day_of_week]} at {p.start_hour}:00 · {p.items.length} tracks
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${p.active ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"}`}>
                  {p.active ? "Active" : "Inactive"}
                </span>
                <Button size="sm" variant="outline" onClick={() => toggleActive(p.id, p.active)}>
                  {p.active ? "Disable" : "Enable"}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deletePlaylist(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
