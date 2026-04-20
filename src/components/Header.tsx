import { Link } from "@tanstack/react-router";
import { Radio, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  return (
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
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">@{profile?.username ?? "…"}</span>
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
  );
}
