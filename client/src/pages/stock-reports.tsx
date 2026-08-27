import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StockMovement } from "@shared/schema";

const numberValue = (value: unknown) => Number(value ?? 0) || 0;

export default function StockReports() {
  const { data: movements = [], isLoading } = useQuery<StockMovement[]>({
    queryKey: ["/api/stock-movements"],
  });

  const summary = useMemo(() => {
    const byType = new Map<string, number>();
    movements.forEach(movement => {
      byType.set(movement.movementType, (byType.get(movement.movementType) ?? 0) + numberValue(movement.quantity));
    });
    return Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);
  }, [movements]);

  return (
    <div className="p-6 pb-20 lg:pb-6 space-y-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <BarChart2 className="h-5 w-5" />
          Stock reporting
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900" data-testid="page-title">Stock Reports</h1>
        <p className="mt-1 text-sm text-gray-600">Review purchasing, usage, adjustments and the central stock movement audit trail.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Movement events</p><p className="mt-1 text-2xl font-semibold">{movements.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Received from suppliers</p><p className="mt-1 text-2xl font-semibold">{(summary.find(([type]) => type === "Received from Supplier")?.[1] ?? 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Used on jobs</p><p className="mt-1 text-2xl font-semibold">{(summary.find(([type]) => type === "Used on Job")?.[1] ?? 0).toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movement totals by type</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-sm text-gray-500">No movement data is available yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.map(([type, quantity]) => (
                <div key={type} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                  <span className="text-sm text-gray-700">{type}</span>
                  <Badge variant="secondary">{quantity.toLocaleString()} units</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent movement detail</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Loading movement detail…</p>
          ) : movements.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No stock movements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[850px] w-full text-sm">
                <thead className="border-y bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Stock item</th>
                    <th className="px-5 py-3">Movement</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Job / client</th>
                    <th className="px-5 py-3">Technician</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.slice(0, 100).map(movement => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-600">{format(new Date(movement.createdAt), "d MMM yyyy")}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{movement.stockItemName}</td>
                      <td className="px-5 py-3 text-gray-600">{movement.movementType}</td>
                      <td className="px-5 py-3 text-gray-700">{numberValue(movement.quantity).toLocaleString()} {movement.unitOfMeasure ?? ""}</td>
                      <td className="px-5 py-3 text-gray-600">{movement.jobNumber ?? movement.clientName ?? "—"}</td>
                      <td className="px-5 py-3 text-gray-600">{movement.technicianName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}