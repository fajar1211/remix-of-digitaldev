import { useLocation } from "react-router-dom";
import { Shield, type LucideIcon } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export type SuperAdminNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export function SuperAdminSidebar({ items }: { items: SuperAdminNavItem[] }) {
  const { open } = useSidebar();
  const { pathname } = useLocation();

  return (
    <Sidebar
      className={
        (open ? "w-[--sidebar-width]" : "w-[--sidebar-width-icon]") +
        " border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      }
      collapsible="icon"
    >
      <SidebarContent>
        {/* Brand */}
        <div className="h-12 flex items-center gap-3 px-3 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary">
            <Shield className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {open && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">Super Admin</div>
              <div className="text-xs text-sidebar-foreground/70 truncate">Control Center</div>
            </div>
          )}
        </div>

        <SidebarGroup>
          {open && <SidebarGroupLabel>Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;

                if (item.disabled) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        className={
                          "opacity-60 cursor-not-allowed hover:bg-transparent text-sidebar-foreground/70" +
                          (active ? " bg-sidebar-accent text-sidebar-primary" : "")
                        }
                        aria-disabled
                        title="Coming soon"
                      >
                        <item.icon className="h-4 w-4" />
                        {open && <span className="truncate">{item.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard/super-admin"}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/70"
                        activeClassName="bg-sidebar-accent text-sidebar-primary"
                      >
                        <item.icon className="h-4 w-4" />
                        {open && <span className="truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
