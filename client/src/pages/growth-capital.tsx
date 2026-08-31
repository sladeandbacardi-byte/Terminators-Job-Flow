import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, CircleDollarSign, Lightbulb, Landmark, Plus, Target, Trash2, TrendingUp } from "lucide-react";

const rand = (value: unknown) => `R${Math.round(Number(value ?? 0)).toLocaleString("en-ZA")}`;
const num = (value: unknown) => Number(value ?? 0) || 0;

type Dashboard = {
  ownerPosition: Record<string, any>;
  recovery: Record<string, any>;
  future: Record<string, any>;
  ideas: any[];
  payments: any[];
  propertyTransactions: any[];
  settings: Record<string, any>;
};

const emptyIdea = {
  name: "", description: "", category: "New Business", stage: "Idea",
  setupCost: 0, monthlyRevenue: 0, monthlyExpenses: 0, monthlyCostSaving: 0,
  staffing: "", propertySpace: "", startDate: "", notes: "", expectedFreeCash: 0,
  propertyFundAllocation: 0, priorityScore: 0,
};

export default function GrowthCapital() {
  const { data, isLoading, error } = useQuery<Dashboard>({ queryKey: ["/api/growth-capital/dashboard"] });
  const [idea, setIdea] = useState(emptyIdea);
  const [payment, setPayment] = useState({ paymentDate: new Date().toISOString().slice(0, 10), amount: 0, paymentType: "Normal", notes: "" });
  const [property, setProperty] = useState({ transactionDate: new Date().toISOString().slice(0, 10), amount: 0, transactionType: "Allocation from Terminators", notes: "" });
  const [extraCash, setExtraCash] = useState(200000);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/growth-capital/dashboard"] });
  const createIdea = useMutation({ mutationFn: () => apiRequest("POST", "/api/growth-capital/ideas", idea), onSuccess: () => { setIdea(emptyIdea); refresh(); } });
  const updateIdea = useMutation({ mutationFn: ({ id, values }: any) => apiRequest("PATCH", `/api/growth-capital/ideas/${id}`, values), onSuccess: refresh });
  const deleteIdea = useMutation({ mutationFn: (id: string) => apiRequest("DELETE", `/api/growth-capital/ideas/${id}`), onSuccess: refresh });
  const addPayment = useMutation({ mutationFn: () => apiRequest("POST", "/api/growth-capital/jan-payments", payment), onSuccess: refresh });
  const deletePayment = useMutation({ mutationFn: (id: string) => apiRequest("DELETE", `/api/growth-capital/jan-payments/${id}`), onSuccess: refresh });
  const addProperty = useMutation({ mutationFn: () => apiRequest("POST", "/api/growth-capital/property-transactions", property), onSuccess: refresh });
  const deleteProperty = useMutation({ mutationFn: (id: string) => apiRequest("DELETE", `/api/growth-capital/property-transactions/${id}`), onSuccess: refresh });
  const updateSettings = useMutation({ mutationFn: (values: any) => apiRequest("PATCH", "/api/growth-capital/settings", values), onSuccess: refresh });

  const position = data?.ownerPosition ?? {};
  const settings = data?.settings ?? {};
  const janPercent = num(settings.jan_allocation_percent || 70);
  const propertyPercent = num(settings.property_allocation_percent || 30);
  const janAllocation = extraCash * janPercent / 100;
  const propertyAllocation = extraCash * propertyPercent / 100;
  const scenarioMonths = useMemo(() => {
    const monthly = num(position.plannedMonthlyPayment) + janAllocation;
    return monthly > 0 ? Math.ceil(num(position.janBalance) / monthly) : null;
  }, [position.plannedMonthlyPayment, position.janBalance, janAllocation]);

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Loading private owner dashboard…</div>;
  if (error || !data) return <div className="p-8 text-red-700">Growth & Capital could not be loaded.</div>;

  const Score = ({ title, value, note, icon: Icon }: any) => (
    <Card><CardContent className="pt-5"><div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>{note && <p className="mt-1 text-xs text-slate-500">{note}</p>}</div>
      <Icon className="h-5 w-5 text-red-600" />
    </div></CardContent></Card>
  );

  return <div className="space-y-6 p-4 md:p-7">
    <div className="rounded-2xl bg-slate-950 p-6 text-white">
      <div className="flex items-center gap-2 text-red-400"><Landmark className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[.2em]">Owner only</span></div>
      <h1 className="mt-2 text-3xl font-bold">Growth & Capital</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Terminators generated {rand(position.operatingSurplus)} operating surplus this month. Jan balance is {rand(position.janBalance)} and the Property Fund is {rand(position.propertyBalance)}.
      </p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Score title="Income this month" value={rand(position.currentIncome)} note="Actual invoice data" icon={TrendingUp} />
      <Score title="Expenses this month" value={rand(position.currentExpenses)} note="Captured finance data" icon={CircleDollarSign} />
      <Score title="Operating surplus" value={rand(position.operatingSurplus)} note={position.cashMargin == null ? "No income data available" : `${position.cashMargin.toFixed(1)}% margin`} icon={Target} />
      <Score title="Jan balance" value={rand(position.janBalance)} note={`${num(position.paidPercent).toFixed(2)}% repaid`} icon={Landmark} />
    </div>

    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="recovery">Revenue Recovery</TabsTrigger>
        <TabsTrigger value="jan">Jan Capital</TabsTrigger>
        <TabsTrigger value="property">Property Fund</TabsTrigger>
        <TabsTrigger value="future">Future Growth</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Owner position</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
            <Score title="Jan paid" value={rand(position.totalPaid)} note={`${position.monthsRemaining ?? "—"} payments remaining`} icon={Landmark} />
            <Score title="Projected payoff" value={position.payoffDate ? new Date(position.payoffDate).toLocaleDateString("en-ZA", { month: "long", year: "numeric" }) : "Not available"} icon={Target} />
            <Score title="Property Fund" value={rand(position.propertyBalance)} note="Planning balance, not a bank balance" icon={Building2} />
            <Score title="Active growth ideas" value={data.future.activeIdeas} note={`${rand(data.future.projectedMonthlyProfit)}/month projected`} icon={Lightbulb} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Owner alerts</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <div className="rounded-lg bg-amber-50 p-3 text-amber-900">{data.recovery.completedUnbilledCount} completed jobs may require invoicing ({rand(data.recovery.completedUnbilledValue)}).</div>
            <div className="rounded-lg bg-red-50 p-3 text-red-900">{data.recovery.overdueActiveClients} overdue customers still have active services.</div>
            <div className="rounded-lg bg-blue-50 p-3 text-blue-900">{data.recovery.quotesAwaitingFollowUp} quotes await follow-up.</div>
          </CardContent></Card>
        </div>
      </TabsContent>

      <TabsContent value="recovery" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Score title="Completed, not invoiced" value={data.recovery.completedUnbilledCount} note={`${rand(data.recovery.completedUnbilledValue)} potential once-off recovery`} icon={CircleDollarSign} />
          <Score title="Quotes awaiting follow-up" value={data.recovery.quotesAwaitingFollowUp} note={rand(data.recovery.quotesAwaitingValue)} icon={TrendingUp} />
          <Score title="Overdue active clients" value={data.recovery.overdueActiveClients} note={`${rand(data.recovery.overdueBalance)} overdue total`} icon={Building2} />
        </div>
        <Card><CardHeader><CardTitle>Potential revenue opportunity</CardTitle></CardHeader><CardContent>
          <p className="text-3xl font-bold">{rand(data.recovery.completedUnbilledValue)}</p>
          <p className="mt-1 text-sm text-slate-500">Potential once-off recovery. Recurring opportunities are kept separate and never added to this total.</p>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="jan" className="space-y-4">
        <Card><CardHeader><CardTitle>Jan Capital Repayment</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Score title="Original" value={rand(position.original)} icon={Landmark} />
            <Score title="Paid" value={rand(position.totalPaid)} icon={TrendingUp} />
            <Score title="Outstanding" value={rand(position.janBalance)} icon={Target} />
            <Score title="Paid" value={`${num(position.paidPercent).toFixed(2)}%`} icon={CircleDollarSign} />
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, num(position.paidPercent))}%` }} /></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label>Planned monthly payment</Label><Input type="number" defaultValue={position.plannedMonthlyPayment} onBlur={e => updateSettings.mutate({ plannedMonthlyPayment: Number(e.target.value) })} /></div>
            <div><Label>Payment date</Label><Input type="date" value={payment.paymentDate} onChange={e => setPayment({ ...payment, paymentDate: e.target.value })} /></div>
            <div><Label>Amount</Label><Input type="number" value={payment.amount} onChange={e => setPayment({ ...payment, amount: Number(e.target.value) })} /></div>
            <div><Label>Type</Label><Select value={payment.paymentType} onValueChange={value => setPayment({ ...payment, paymentType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Normal","Extra","Mixed / Combined"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="md:col-span-2"><Label>Notes</Label><Input value={payment.notes} onChange={e => setPayment({ ...payment, notes: e.target.value })} /></div>
          </div>
          <Button onClick={() => addPayment.mutate()} disabled={payment.amount < 0 || addPayment.isPending}><Plus className="mr-2 h-4 w-4" />Record Jan Payment</Button>
          <div className="divide-y rounded-lg border">{data.payments.map(row => <div key={row.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><b>{row.payment_date}</b> · {row.payment_type}<div className="text-xs text-slate-500">{row.notes}</div></div><div className="flex items-center gap-2"><b>{rand(row.amount)}</b><Button size="icon" variant="ghost" onClick={() => deletePayment.mutate(row.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="property" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Score title="Property Fund" value={rand(position.propertyBalance)} note="Starts at R0 unless transactions exist" icon={Building2} />
          <Score title="Target" value={rand(settings.property_target)} icon={Target} />
          <Score title="Annual planned allocation" value={rand(propertyAllocation * 12)} icon={TrendingUp} />
        </div>
        <Card><CardHeader><CardTitle>Additional cash allocation</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">
          <div><Label>Additional free cash</Label><Input type="number" value={extraCash} onChange={e => setExtraCash(Number(e.target.value))} /></div>
          <div><Label>Jan allocation</Label><Input type="number" value={janPercent} onChange={e => updateSettings.mutate({ janAllocationPercent: Number(e.target.value), propertyAllocationPercent: 100 - Number(e.target.value) })} /><p className="text-xs text-slate-500">{rand(janAllocation)}</p></div>
          <div><Label>Property allocation</Label><Input type="number" value={propertyPercent} readOnly /><p className="text-xs text-slate-500">{rand(propertyAllocation)} · payoff in about {scenarioMonths ?? "—"} months</p></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Property Fund transaction</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3"><Input type="date" value={property.transactionDate} onChange={e => setProperty({...property, transactionDate:e.target.value})}/><Input type="number" value={property.amount} onChange={e => setProperty({...property, amount:Number(e.target.value)})}/><Select value={property.transactionType} onValueChange={v => setProperty({...property,transactionType:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Allocation from Terminators","Additional contribution","Withdrawal","Property expense","Other"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
          <Input placeholder="Description / notes" value={property.notes} onChange={e => setProperty({...property,notes:e.target.value})}/>
          <Button onClick={() => addProperty.mutate()}><Plus className="mr-2 h-4 w-4"/>Add transaction</Button>
          <div className="divide-y rounded-lg border">{data.propertyTransactions.map(row=><div key={row.id} className="flex justify-between p-3 text-sm"><span>{row.transaction_date} · {row.transaction_type}</span><span className="flex items-center gap-2"><b>{rand(row.amount)}</b><Button size="icon" variant="ghost" onClick={()=>deleteProperty.mutate(row.id)}><Trash2 className="h-4 w-4"/></Button></span></div>)}</div>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="future" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Score title="Monthly income" value={rand(data.future.projectedMonthlyRevenue)} icon={TrendingUp}/>
          <Score title="Cost saving" value={rand(data.future.projectedMonthlyCostSaving)} icon={CircleDollarSign}/>
          <Score title="Projected profit" value={rand(data.future.projectedMonthlyProfit)} icon={Target}/>
          <Score title="Capital required" value={rand(data.future.capitalRequired)} icon={Landmark}/>
        </div>
        <Card><CardHeader><CardTitle>Growth pipeline</CardTitle></CardHeader><CardContent className="space-y-3">
          {data.ideas.map(row => {
            const profit = num(row.monthly_revenue)-num(row.monthly_expenses)+num(row.monthly_cost_saving);
            return <div key={row.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{row.name}</h3><p className="mt-1 max-w-3xl text-sm text-slate-600">{row.description}</p><div className="mt-2 flex gap-2"><Badge>{row.category}</Badge><Badge variant="outline">{rand(profit)}/month</Badge></div></div><div className="flex items-center gap-2"><Select value={row.stage} onValueChange={stage => updateIdea.mutate({id:row.id,values:{stage}})}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent>{["Idea","Research","Testing","Approved","In Development","Operating"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="ghost" onClick={()=>deleteIdea.mutate(row.id)}><Trash2 className="h-4 w-4"/></Button></div></div>{row.notes && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">{row.notes}</p>}</div>;
          })}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Add growth idea</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Idea name" value={idea.name} onChange={e=>setIdea({...idea,name:e.target.value})}/>
          <Input placeholder="Category" value={idea.category} onChange={e=>setIdea({...idea,category:e.target.value})}/>
          <Select value={idea.stage} onValueChange={stage=>setIdea({...idea,stage})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Idea","Research","Testing","Approved","In Development","Operating"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
          <Input className="md:col-span-3" placeholder="Description" value={idea.description} onChange={e=>setIdea({...idea,description:e.target.value})}/>
          <Input type="number" placeholder="Setup cost" value={idea.setupCost} onChange={e=>setIdea({...idea,setupCost:Number(e.target.value)})}/>
          <Input type="number" placeholder="Monthly revenue" value={idea.monthlyRevenue} onChange={e=>setIdea({...idea,monthlyRevenue:Number(e.target.value)})}/>
          <Input type="number" placeholder="Monthly expenses" value={idea.monthlyExpenses} onChange={e=>setIdea({...idea,monthlyExpenses:Number(e.target.value)})}/>
          <Input type="number" placeholder="Monthly cost saving" value={idea.monthlyCostSaving} onChange={e=>setIdea({...idea,monthlyCostSaving:Number(e.target.value)})}/>
          <Input type="number" placeholder="Property allocation" value={idea.propertyFundAllocation} onChange={e=>setIdea({...idea,propertyFundAllocation:Number(e.target.value)})}/>
          <Input type="number" min={0} max={35} placeholder="Priority score" value={idea.priorityScore} onChange={e=>setIdea({...idea,priorityScore:Number(e.target.value)})}/>
          <Input className="md:col-span-3" placeholder="Notes, staffing and property requirements" value={idea.notes} onChange={e=>setIdea({...idea,notes:e.target.value})}/>
          <Button className="md:col-span-3" onClick={()=>createIdea.mutate()} disabled={!idea.name || createIdea.isPending}><Plus className="mr-2 h-4 w-4"/>Add growth idea</Button>
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>;
}