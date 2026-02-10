import { useMemo, useState } from 'react';
import { 
  BarChart3, TrendingUp, Eye, Users, MousePointerClick, 
  Calendar, Download, ArrowUp, ArrowDown 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportingTasksCard } from '@/components/dashboard/ReportingTasksCard';

interface MetricCard {
  title: string;
  value: string;
  change: number;
  icon: any;
  color: string;
}

const metrics: MetricCard[] = [
  {
    title: 'Total Views',
    value: '12,456',
    change: 12.5,
    icon: Eye,
    color: 'text-blue-500',
  },
  {
    title: 'Profile Visits',
    value: '3,254',
    change: 8.2,
    icon: Users,
    color: 'text-green-500',
  },
  {
    title: 'Click Actions',
    value: '1,089',
    change: -3.4,
    icon: MousePointerClick,
    color: 'text-purple-500',
  },
  {
    title: 'Engagement Rate',
    value: '24.5%',
    change: 15.2,
    icon: TrendingUp,
    color: 'text-orange-500',
  },
];

const performanceData = [
  { label: 'Google Maps Views', value: 78, total: 100 },
  { label: 'Website Clicks', value: 65, total: 100 },
  { label: 'Phone Calls', value: 42, total: 100 },
  { label: 'Direction Requests', value: 55, total: 100 },
  { label: 'Social Engagement', value: 38, total: 100 },
];

export default function Reporting() {
  const [dateRange, setDateRange] = useState('30');

  const days = useMemo(() => {
    const n = Number.parseInt(dateRange, 10);
    return Number.isFinite(n) ? n : 30;
  }, [dateRange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Reporting & Visibility
          </h1>
          <p className="text-muted-foreground">Track your business performance and visibility</p>
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
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <metric.icon className={`h-8 w-8 ${metric.color}`} />
                <div className={`flex items-center text-sm ${
                  metric.change >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {metric.change >= 0 ? (
                    <ArrowUp className="h-4 w-4 mr-1" />
                  ) : (
                    <ArrowDown className="h-4 w-4 mr-1" />
                  )}
                  {Math.abs(metric.change)}%
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                <p className="text-sm text-muted-foreground">{metric.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reporting Tasks (Completed only) */}
      <ReportingTasksCard days={days} />

      {/* Performance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
          <CardDescription>How your business is performing across channels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {performanceData.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{item.value}%</span>
              </div>
              <Progress value={item.value} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Visibility Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Google Maps Visibility</CardTitle>
            <CardDescription>Your presence on Google Maps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Search Impressions</span>
                <span className="font-semibold text-foreground">8,432</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Maps Impressions</span>
                <span className="font-semibold text-foreground">4,024</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Average Position</span>
                <span className="font-semibold text-foreground">#3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Review Score</span>
                <span className="font-semibold text-foreground">4.7 ⭐</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions Summary</CardTitle>
            <CardDescription>Customer interactions this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Website Clicks</span>
                <span className="font-semibold text-foreground">1,245</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phone Calls</span>
                <span className="font-semibold text-foreground">342</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Direction Requests</span>
                <span className="font-semibold text-foreground">567</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Message Inquiries</span>
                <span className="font-semibold text-foreground">89</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
