import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Search, Radio, LogOut, Sun, Moon, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { UserProfile, getAvatarUrl } from "@/components/UserProfile";

interface Props {
  onToggleSidebar: () => void;
  onSearch?: (q: string) => void;
}

export function TopBar({ onToggleSidebar, onSearch }: Props) {
  const { user, profile, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-14 flex items-center gap-2 sm:gap-4 px-2 sm:px-4">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle menu">
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <div className="h-7 w-7 rounded-full grid place-items-center" style={{ background: "var(--gradient-radio)" }}>
                <Radio className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="hidden sm:inline tracking-tight">Lovable Radio</span>
            </Link>
          </div>

          {/* Center: search */}
          <form
            onSubmit={(e) => { e.preventDefault(); onSearch?.(query); }}
            className="flex-1 max-w-2xl mx-auto flex items-center"
          >
            <div className="flex w-full items-center">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tracks, artists, requests…"
                className="h-10 rounded-l-full rounded-r-none border-r-0 focus-visible:ring-1"
              />
              <Button
                type="submit"
                variant="secondary"
                className="h-10 rounded-r-full rounded-l-none px-4 sm:px-6 border border-l-0 border-input"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {/* Right: user actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setIsDark(d => !d)} title="Toggle theme">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" title="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            {user ? (
              <>
                <button
                  onClick={() => setProfileOpen(true)}
                  className="ml-1 hover:opacity-80 transition-opacity"
                  title="Edit profile"
                >
                  {profile && (
                    <img
                      src={getAvatarUrl(profile.username, profile.avatar_url)}
                      alt={profile.username}
                      className="h-8 w-8 rounded-full object-cover border border-border"
                    />
                  )}
                </button>
                <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
                <Link to="/signup" className="hidden sm:inline-flex"><Button size="sm">Sign up</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>
      <UserProfile open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
