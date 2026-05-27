import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/portal/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { Scroll } from "lucide-react";
import { ThemeToggle } from "@/components/portal/ThemeToggle";
import { NotificationBell } from "@/components/portal/NotificationBell";
import { CopilotProvider } from "@/components/portal/CopilotProvider";
import { CommandPalette } from "@/components/portal/CommandPalette";
import { ToastsContainer } from "@/components/portal/ToastsContainer";
import { BudgetBanner } from "@/components/portal/BudgetBanner";

/**
 * Layout wrapper that provides sidebar context and renders the app sidebar, a header with controls, and a scrollable main content area.
 *
 * @param children - Content to render inside the layout's main scrollable area; `CommandPalette` is mounted after this content.
 * @returns A React element composing `SidebarProvider` with `AppSidebar`, a header (including `SidebarTrigger`, branding, and `ThemeToggle`), and a main container that wraps `children` with `CopilotProvider`.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <BudgetBanner />
        <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border/40 px-4 bg-card/30">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4 bg-border/60" />
          <div className="flex items-center gap-2">
            <Scroll className="h-4 w-4 text-primary/70" />
            <span
              className="text-xs font-semibold text-primary tracking-[0.2em] uppercase"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              All Reach Chronicle
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <CopilotProvider>
            {children}
            <CommandPalette />
            <ToastsContainer />
          </CopilotProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
