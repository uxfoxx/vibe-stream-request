import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Radio, LogOut, Shield, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { UserProfile, getAvatarUrl } from "@/components/UserProfile";

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : document.documentElement.classList.contains("dark");
  });

  // F30: Dark mode toggle
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <>
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="h-8 w-8 rounded-full grid place-items-center" style={{ background: "var(--gradient-radio)" }}>
              <Radio className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>Lovable Radio</span>
          </Link>
          <nav className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin">
                <Button variant="ghost" size="sm"><Shield className="h-4 w-4" /> Admin</Button>
              </Link>
            )}
            {/* F30: Dark mode toggle */}
            <Button variant="ghost" size="icon" onClick={() => setIsDark(d => !d)} title="Toggle theme">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {user ? (
              <>
                {/* F20: Avatar + profile modal trigger */}
                <button
                  onClick={() => setProfileOpen(true)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  title="Edit profile"
                >
                  {profile && (
                    <img
                      src={getAvatarUrl(profile.username, profile.avatar_url)}
                      alt={profile.username}
                      className="h-7 w-7 rounded-full object-cover border border-border"
                    />
                  )}
                  <span className="text-sm text-muted-foreground hidden sm:inline">@{profile?.username ?? "…"}</span>
                </button>
                <Button variant="ghost" size="sm" onClick={() => signOut()}><LogOut className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
                <Link to="/signup"><Button size="sm">Sign up</Button></Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <UserProfile open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
