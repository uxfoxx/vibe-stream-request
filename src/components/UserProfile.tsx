import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function getAvatarUrl(username: string, avatarUrl: string | null): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=6366f1&textColor=ffffff`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfile({ open, onOpenChange }: Props) {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  if (!user || !profile) return null;

  async function save() {
    if (!user || !profile) return;
    const newUsername = username.trim();
    if (!newUsername) { toast.error("Username cannot be empty"); return; }
    setSaving(true);
    try {
      // Check username uniqueness (skip if unchanged)
      if (newUsername !== profile.username) {
        const { data: existing } = await supabase.from("profiles")
          .select("id").eq("username", newUsername).maybeSingle();
        if (existing) { toast.error("Username already taken"); return; }
      }
      const { error } = await supabase.from("profiles").update({
        username: newUsername,
        avatar_url: avatarUrl.trim() || null,
      }).eq("id", user.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Profile updated");
      onOpenChange(false);
      // Reload page to refresh auth context profile
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  const preview = getAvatarUrl(username || profile.username, avatarUrl || null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <img src={preview} alt="Avatar preview" className="h-20 w-20 rounded-full object-cover border border-border" />
          <div className="w-full space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                placeholder="username"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Avatar URL (optional)</label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
              />
              <p className="text-xs text-muted-foreground">Leave blank to use your initials.</p>
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
