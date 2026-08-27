import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Box, PackageCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem, StockMovement } from "@shared/schema";

type StockAlerts = {
  lowStock?: InventoryItem[];
  reorderRequired?: InventoryItem[];
  overstocked?: InventoryItem[];
};

const numberValue = (value: unknown) => Number(value ?? 0) || 0;

export default function StockDashboard() {
  const { data: items = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });
  const { data: alerts } = useQuery<StockAlerts>({
    queryKey: ["/api/inventory/alerts/stock"],
  });
  const { data: movements = [], isLoading: movementsLoading } = useQuery<StockMovement[]>({
    queryKey: ["/api/stock-movements"],
  });

  const lowStockIds = useMemo(
    () => new Set([...(alerts?.lowStock ?? []), ...(alerts?.reorderRequired ?? [])].map(item => item.id)),
    [alerts],
  );
  const monthStart = startOfMonth(new Date());
  const thisMonth = movements.filter(movement => new Date(movement.createdAt) >= monthStart);
  const purchasedThisMonth = thisMonth
    .filter(movement => movement.movementType === "Received from Supplier")
    .reduce((total, movement) => total + numberValue(movement.quantity), 0);
  const usedThisMonth = thisMonth
    .filter(movement => movement.movementType === "Used on Job")
    .reduce((total, movement) => total + numberValue(movement.quantity), 0);

  const stats = [
    { label: "Total inventory items", value: items.length, icon: Box, colour: "text-blue-600", background: "bg-blue-50" },
    { label: "Low-stock items", value: lowStockIds.size, icon: AlertTriangle, colour: "text-amber-600", background: "bg-amber-50" },
    { label: "Out-of-stock items", value: items.filter(item => numberValue(item.quantity) <= 0).length, icon: PackageCheck, colour: "text-red-600", background: "bg-red-50" },
    { label: "Purchased this month", value: purchasedThisMonth.toLocaleString(), icon: ArrowDownToLine, colour: "text-emerald-600", background: "bg-emerald-50" },
    { label: "Used this month", value: usedThisMonth.toLocaleString(), icon: ArrowUpFromLine, colour: "text-purple-600", background: "bg-purple-50" },
  ];

  return (
    <div className="p-6 pb-20 lg:pb-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Stock Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Operational stock levels, movement activity and replenishment signals.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg p-2 ${stat.background}`}>
                  <Icon className={`h-5 w-5 ${stat.colour}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="mt-0.5 text-xl font-semibold text-gray-900">
                    {itemsLoading ? "—" : stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Replenishment alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {(alerts?.lowStock?.length ?? 0) + (alerts?.reorderRequired?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">No low-stock items need attention.</p>
            ) : (
              <div className="space-y-2">
                {[...(alerts?.lowStock ?? []), ...(alerts?.reorderRequired ?? [])]
                  .filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index)
                  .slice(0, 8)
                  .map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">On hand: {numberValue(item.quantity).toLocaleString()} {item.unitOfMeasure ?? ""}</p>
                      </div>
                      <Badge variant="outline" className="border-amber-200 text-amber-700">Reorder</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent stock transactions</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Latest central stock activity</p>
            </div>
            <span className="text-xs text-gray-500">{format(new Date(), "MMM yyyy")}</span>
          </CardHeader>
          <CardContent>
            {movementsLoading ? (
              <p className="text-sm text-gray-500">Loading transactions…</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-gray-500">No stock transactions recorded yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {movements.slice(0, 8).map(movement => (
                  <div key={movement.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{movement.stockItemName}</p>
                      <p className="truncate text-xs text-gray-500">{movement.movementType} · {movement.createdBy}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-700">{numberValue(movement.quantity).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{format(new Date(movement.createdAt), "d MMM")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}