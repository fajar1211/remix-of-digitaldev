import { useMemo, useState } from "react";
import { Calendar, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportingTasksCard } from "@/components/dashboard/ReportingTasksCard";

export default function TaskReports() {
  const [dateRange, setDateRange] = useState("30");

  const days = useMemo(() => {
    const n = Number.parseInt(dateRange, 10);
    return Number.isFinite(n) ? n : 30;
  }, [dateRange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Task Reports</h2>
          <p className="text-sm text-muted-foreground">
            Completed tasks based on completion timestamp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 1 year</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <ReportingTasksCard days={days} />
    </div>
  );
}
