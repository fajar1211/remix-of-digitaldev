import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, Users, type LucideIcon } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

export type AdminNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  disabled?: boolean;
  children?: AdminNavItem[];
  badgeCount?: number;
};

export function AdminSidebar({ items }: { items: AdminNavItem[] }) {
  const { open } = useSidebar();
  const { pathname } = useLocation();

  const isActive = (url: string) => pathname === url;
  const isInBranch = (url: string) => pathname === url || pathname.startsWith(url + "/");

  const defaultExpanded = useMemo(() => {
    const map: Record<string, boolean> = {};
    items.forEach((item) => {
      if (item.children?.length) map[item.title] = isInBranch(item.url);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, pathname]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(defaultExpanded);

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
            <Users className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {open && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">Admin Operations</div>
              <div className="text-xs text-sidebar-foreground/70 truncate">Control Center</div>
            </div>
          )}
        </div>

        <SidebarGroup>
          {open && <SidebarGroupLabel>Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                const branchActive = isInBranch(item.url);
                const hasChildren = !!item.children?.length;
                const isExpanded = expanded[item.title] ?? branchActive;

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
                        <span className="relative inline-flex">
                          <item.icon className="h-4 w-4" />
                          {!open && (item.badgeCount ?? 0) > 0 && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                          )}
                        </span>
                        {open && (
                          <span className="truncate flex-1">{item.title}</span>
                        )}
                        {open && (item.badgeCount ?? 0) > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {item.badgeCount}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                if (hasChildren) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => setExpanded((p) => ({ ...p, [item.title]: !(p[item.title] ?? branchActive) }))}
                        className={
                          "flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/70" +
                          (branchActive ? " bg-sidebar-accent text-sidebar-primary" : "")
                        }
                      >
                        <span className="relative inline-flex">
                          <item.icon className="h-4 w-4" />
                          {!open && (item.badgeCount ?? 0) > 0 && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                          )}
                        </span>
                        {open && (
                          <>
                            <span className="truncate flex-1">{item.title}</span>
                            {(item.badgeCount ?? 0) > 0 && (
                              <Badge variant="destructive" className="mr-1">
                                {item.badgeCount}
                              </Badge>
                            )}
                            <ChevronDown className={"h-4 w-4 transition-transform " + (isExpanded ? "rotate-180" : "rotate-0")} />
                          </>
                        )}
                      </SidebarMenuButton>

                      {open && isExpanded && (
                        <SidebarMenuSub>
                          {item.children!.map((child) => (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={child.url}
                                  end
                                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/70"
                                  activeClassName="bg-sidebar-accent text-sidebar-primary"
                                >
                                  <child.icon className="h-4 w-4" />
                                  <span className="truncate flex-1">{child.title}</span>
                                  {(child.badgeCount ?? 0) > 0 && (
                                    <Badge variant="destructive">{child.badgeCount}</Badge>
                                  )}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/70"
                        activeClassName="bg-sidebar-accent text-sidebar-primary"
                      >
                        <span className="relative inline-flex">
                          <item.icon className="h-4 w-4" />
                          {!open && (item.badgeCount ?? 0) > 0 && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                          )}
                        </span>
                        {open && <span className="truncate flex-1">{item.title}</span>}
                        {open && (item.badgeCount ?? 0) > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {item.badgeCount}
                          </Badge>
                        )}
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
