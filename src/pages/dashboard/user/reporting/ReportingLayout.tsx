import { BarChart3 } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const items = [
  { label: "Task Reports", to: "/dashboard/user/reporting/task-reports" },
  { label: "Performance Summary", to: "/dashboard/user/reporting/performance-summary" },
  { label: "Local Insights", to: "/dashboard/user/reporting/local-insights" },
  { label: "Keyword Rankings", to: "/dashboard/user/reporting/keyword-rankings" },
  { label: "Traffic Insights", to: "/dashboard/user/reporting/traffic-insights" },
  { label: "Conversion Insights", to: "/dashboard/user/reporting/conversion-insights" },
  { label: "Downloadable Reports", to: "/dashboard/user/reporting/downloadable-reports" },
];

export default function ReportingLayout() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Reporting & Visibility
          </h1>
          <p className="text-muted-foreground">Track your business performance and visibility</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-2 min-w-0">
          <div className="text-xs font-medium text-muted-foreground">Submenu</div>
          <nav className="space-y-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "block rounded-md border border-border px-3 py-2 text-sm transition-colors",
                    // keep submenu narrow but ensure labels are fully visible
                    "whitespace-normal break-words leading-snug",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "bg-background hover:bg-accent/60",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
