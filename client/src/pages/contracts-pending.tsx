import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, FileText, CheckCircle, ArrowRight, Clock, PenLine,
} from "lucide-react";
import { format } from "date-fns";
import type { QuoteSubmission, Worker } from "@shared/schema";

const PENDING_STAGES = ["accepted", "contract_pending", "installation_scheduled"];

const STAGE_CONFIG: Record<string, {
  label: string; description: string; headerCls: string; iconCls: string; icon: any;
}> = {
  installation_scheduled: {
    label: "Service Scheduled — Contract Not Signed",
    description: "Service or installation has been scheduled but no signed contract on file.",
    headerCls: "bg-red-50 border-red-200",
    iconCls:   "text-red-500",
    icon:      AlertTriangle,
  },
  contract_pending: {
    label: "Contract Pending / Not Signed",
    description: "Contract created or sent but not yet signed by the client.",
    headerCls: "bg-amber-50 border-amber-200",
    iconCls:   "text-amber-600",
    icon:      Clock,
  },
  accepted: {
    label: "Accepted — Awaiting Contract",
    description: "Quote accepted but no contract has been created yet.",
    headerCls: "bg-green-50 border-green-200",
    iconCls:   "text-green-600",
    icon:      CheckCircle,
  },
};

export default function ContractsPendingPage() {
  const [, navigate] = useLocation();
  const { data: leads = [], isLoading } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const pending = useMemo(() =>
    leads.filter(l => {
      const stage = (l as any).stage || l.status;
      return PENDING_STAGES.includes(stage);
    }),
    [leads]);

  const byStage = useMemo(() => {
    const map: Record<string, QuoteSubmission[]> = {
      accepted: [], contract_pending: [], installation_scheduled: [],
    };
    pending.forEach(l => {
      const s = (l as any).stage || l.status;
      if (map[s]) map[s].push(l);
    });
    return map;
  }, [pending]);

  const workerName = (id: string | null | undefined) =>
    workers.find(w => w.id === id)?.name ?? "Unassigned";

  const totalWarning = byStage.installation_scheduled.length;

  return (
        <div className="p-4 sm:p-6 pb-20 lg:pb-6">
          <div className="max-w-4xl mx-auto space-y-4">

            <p className="text-sm text-gray-500">
              Accepted quotes that need a contract created, sent, or signed before service begins.
            </p>

            {/* Warning banner */}
            {totalWarning > 0 && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-red-800 text-sm">
                    Warning: Service scheduled without signed contract
                  </div>
                  <div className="text-xs text-red-700 mt-1">
                    {totalWarning} {totalWarning === 1 ? "lead has" : "leads have"} a service/installation scheduled but no signed contract on file.
                    Follow up with the client immediately to get the contract signed.
                  </div>
                </div>
              </div>
            )}

            {isLoading && <div className="py-12 text-center text-gray-400">Loading…</div>}

            {!isLoading && pending.length === 0 && (
              <div className="py-14 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <div className="font-semibold text-gray-600">All clear — no contracts pending.</div>
                <div className="text-sm text-gray-400 mt-1">
                  Accepted quotes with pending contracts will appear here automatically.
                </div>
              </div>
            )}

            {/* Groups — show installation_scheduled first (highest urgency) */}
            {(["installation_scheduled","contract_pending","accepted"] as const).map(stageKey => {
              const group = byStage[stageKey] ?? [];
              if (group.length === 0) return null;
              const cfg = STAGE_CONFIG[stageKey];
              const Icon = cfg.icon;

              return (
                <div key={stageKey} className={`border rounded-xl overflow-hidden ${cfg.headerCls}`}>
                  <div className="px-4 py-3 flex items-center gap-2 border-b">
                    <Icon className={`h-4 w-4 ${cfg.iconCls}`} />
                    <span className="font-semibold text-gray-800 text-sm">{cfg.label}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {group.length} lead{group.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 px-4 py-2 bg-white/60 border-b">{cfg.description}</p>

                  <div className="divide-y divide-gray-100">
                    {group.map(lead => (
                      <div key={lead.id} className="px-4 py-3 bg-white hover:bg-gray-50/60 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{lead.companyName}</span>
                            {(lead as any).tradingName && (
                              <span className="text-xs text-gray-400">t/a {(lead as any).tradingName}</span>
                            )}
                            {lead.quoteNumber && (
                              <span className="text-xs font-mono text-gray-400">{lead.quoteNumber}</span>
                            )}
                            {(lead as any).quoteType && (
                              <Badge variant="outline" className="text-[11px]">{(lead as any).quoteType}</Badge>
                            )}
                            {(lead as any).priority === "high" && (
                              <Badge className="bg-red-100 text-red-700 border-0 text-[11px]">High Priority</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {lead.contactPerson} · {lead.phone}
                            {lead.address && ` · ${lead.address}`}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {lead.quoteAmount && (
                              <span className="text-xs font-semibold text-gray-700">R {lead.quoteAmount}</span>
                            )}
                            {(lead as any).monthlyRecurring && (
                              <span className="text-xs text-gray-500">R {(lead as any).monthlyRecurring}/mo recurring</span>
                            )}
                            <span className="text-xs text-gray-400">Rep: {workerName(lead.assignedTo)}</span>
                            {lead.submittedAt && (
                              <span className="text-xs text-gray-400">
                                Submitted {format(new Date(lead.submittedAt), "d MMM yyyy")}
                              </span>
                            )}
                          </div>
                          {lead.notes && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{lead.notes}</div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <Button size="sm" variant="default"
                            onClick={() => navigate(`/contracts`)}
                            className="h-7 text-xs gap-1">
                            <FileText className="h-3 w-3" /> Create Contract
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => navigate("/quotes")}
                            className="h-7 text-xs gap-1">
                            <ArrowRight className="h-3 w-3" /> View Quote
                          </Button>
                          {stageKey === "contract_pending" && (
                            <Button size="sm" variant="outline"
                              onClick={() => navigate("/quotes")}
                              className="h-7 text-xs gap-1">
                              <PenLine className="h-3 w-3" /> Mark Signed
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
  );
}
