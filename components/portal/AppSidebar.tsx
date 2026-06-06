"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  Brain,
  Search,
  LayoutDashboard,
  ShieldAlert,
  Network,
  Microscope,
  Settings,
  Swords,
  MapPin,
  CalendarDays,
  BookMarked,
  Upload,
  Scroll,
  Globe,
  Plus,
  BarChart2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Chronicle",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/lore", icon: BookOpen, label: "Lore Browser" },
      { href: "/search", icon: Search, label: "Search" },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/brain-dump", icon: Brain, label: "Brain Dump" },
      { href: "/brain-dump/bulk", icon: Upload, label: "Bulk Queue" },
    ],
  },
  {
    label: "Session",
    items: [
      { href: "/session", icon: Swords, label: "Session Workspace" },
      { href: "/quests", icon: MapPin, label: "Quests & Hooks" },
      { href: "/timeline", icon: CalendarDays, label: "Timeline" },
      { href: "/statblocks", icon: BookMarked, label: "Statblock Library" },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { href: "/ai/consistency", icon: ShieldAlert, label: "Consistency" },
      { href: "/ai/relationships", icon: Network, label: "Relationships" },
      { href: "/ai/gaps", icon: Microscope, label: "Gap Detector" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/usage", icon: BarChart2, label: "Usage" },
      { href: "/import", icon: Upload, label: "Import" },
      { href: "/shared", icon: Globe, label: "Shared Content" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Scroll className="h-5 w-5 text-primary" />
          <span className="font-bold text-primary tracking-wider text-sm uppercase" style={{ fontFamily: "var(--font-cinzel)" }}>
            AllCodex
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 pl-7">Lore Chronicle</p>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {navItems.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel
              style={{ fontFamily: "var(--font-cinzel)" }}
              className="text-[10px] tracking-[0.15em] uppercase font-medium"
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        <Link
          href="/lore/new"
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-secondary-foreground bg-secondary/40 hover:bg-secondary/60 transition-colors rounded-none border border-secondary/30"
        >
          <Plus className="h-3.5 w-3.5" />
          <span style={{ fontFamily: "var(--font-cinzel)" }} className="uppercase tracking-wider text-[10px]">New Entry</span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
