import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Home, ListMusic, History as HistoryIcon, MessageSquare, Shield, Radio, Music2, Heart, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  onClick?: () => void;
  adminOnly?: boolean;
}

interface Props {
  collapsed: boolean;
  onNavigate?: () => void;
  activeSection: string;
  onSectionChange: (s: string) => void;
}

export function Sidebar({ collapsed, onNavigate, activeSection, onSectionChange }: Props) {
  const { isAdmin } = useAuth();

  const main: NavItem[] = [
    { label: "Now Playing", icon: Home, onClick: () => onSectionChange("now") },
    { label: "Up Next", icon: ListMusic, onClick: () => onSectionChange("queue") },
    { label: "History", icon: HistoryIcon, onClick: () => onSectionChange("history") },
    { label: "Live Chat", icon: MessageSquare, onClick: () => onSectionChange("chat") },
  ];

  const explore: NavItem[] = [
    { label: "Trending", icon: Heart, onClick: () => onSectionChange("queue") },
    { label: "Listeners", icon: Users, onClick: () => onSectionChange("now") },
    { label: "Genres", icon: Music2, onClick: () => onSectionChange("queue") },
  ];

  function NavBtn({ item }: { item: NavItem }) {
    const Icon = item.icon;
    const isActive =
      (item.label === "Now Playing" && activeSection === "now") ||
      (item.label === "Up Next" && activeSection === "queue") ||
      (item.label === "History" && activeSection === "history") ||
      (item.label === "Live Chat" && activeSection === "chat");
    const cls = cn(
      "w-full flex items-center gap-6 rounded-lg transition-colors text-left",
      collapsed ? "flex-col gap-1 px-1 py-4 text-[10px]" : "px-3 py-2.5 text-sm",
      isActive ? "bg-accent/30 font-semibold" : "hover:bg-muted/60",
    );
    const inner = (
      <>
        <Icon className={cn(collapsed ? "h-6 w-6" : "h-5 w-5", "shrink-0")} />
        <span className={cn(collapsed ? "leading-tight text-center" : "")}>{item.label}</span>
      </>
    );
    if (item.to) {
      return (
        <Link to={item.to} className={cls} onClick={onNavigate}>
          {inner}
        </Link>
      );
    }
    return (
      <button
        onClick={() => { item.onClick?.(); onNavigate?.(); }}
        className={cls}
      >
        {inner}
      </button>
    );
  }

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-border bg-background overflow-y-auto",
        collapsed ? "w-[72px] py-2" : "w-60 py-3",
      )}
    >
      <nav className={cn("flex flex-col", collapsed ? "px-1 gap-0.5" : "px-2 gap-0.5")}>
        {main.map((it) => <NavBtn key={it.label} item={it} />)}
      </nav>

      {!collapsed && (
        <>
          <div className="my-2 border-t border-border" />
          <div className="px-5 pt-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
            Explore
          </div>
          <nav className="flex flex-col px-2 gap-0.5">
            {explore.map((it) => <NavBtn key={it.label} item={it} />)}
          </nav>

          {isAdmin && (
            <>
              <div className="my-2 border-t border-border" />
              <div className="px-5 pt-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
                Admin
              </div>
              <nav className="flex flex-col px-2 gap-0.5">
                <Link to="/admin" className="w-full flex items-center gap-6 rounded-lg px-3 py-2.5 text-sm hover:bg-muted/60" onClick={onNavigate}>
                  <Shield className="h-5 w-5 shrink-0" />
                  <span>Studio</span>
                </Link>
              </nav>
            </>
          )}

          <div className="px-5 pt-6 pb-4 text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1.5"><Radio className="h-3 w-3" /> Lovable Radio</p>
            <p>© {new Date().getFullYear()}</p>
          </div>
        </>
      )}
    </aside>
  );
}
