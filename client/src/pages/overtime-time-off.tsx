import { useState } from "react";
import { Clock3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import MyTime from "@/pages/my-time";
import TimeOvertime from "@/pages/time-overtime";

export default function OvertimeTimeOff() {
  const { user } = useAuth();
  const role = getDashboardRole(user ?? {});
  const canReviewStaffTime = role === "admin" || role === "manager";
  const [tab, setTab] = useState<"my-time" | "overtime">("my-time");

  return (
    <div className="p-6 pb-20 lg:pb-6">
      <div className="mb-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <Clock3 className="h-5 w-5" />
          Human resources
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Overtime &amp; Time Off</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review personal time, overtime, authorised time off and staff approvals from one place.
        </p>
      </div>

      <Tabs value={tab} onValueChange={value => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="my-time">My Time</TabsTrigger>
          {canReviewStaffTime && <TabsTrigger value="overtime">Overtime &amp; Time Off</TabsTrigger>}
        </TabsList>
        <TabsContent value="my-time" className="mt-5">
          <MyTime />
        </TabsContent>
        {canReviewStaffTime && (
          <TabsContent value="overtime" className="mt-5">
            <TimeOvertime />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}