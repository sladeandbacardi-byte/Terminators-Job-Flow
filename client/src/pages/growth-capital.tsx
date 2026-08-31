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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Archive, Building2, CircleDollarSign, Edit3, Lightbulb, Landmark, Plus, RotateCcw, Target, Trash2, TrendingUp } from "lucide-react";

const rand = (value: unknown) => `R${Math.round(Number(value ?? 0)).toLocaleString("en-ZA")}`;
const num = (value: unknown) => Number(value ?? 0) || 0;

type Dashboard = {
  ownerPosition: Record<string, any>;
  recovery: Record<string, any>;
  future: Record<string, any>;
  ideas: any[];
  categories: any[];
  relationships: any[];
  internalTransactions: any[];
  propertyPlans: any[];
  linkedRecords: any[];
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

const planningConfig:any = {
  categories:{title:"Categories",rows:"categories",fields:[["name","Category name","text"]]},
  relationships:{title:"Ecosystem relationships",rows:"relationships",fields:[["fromIdeaId","From idea","idea"],["toIdeaId","To idea","idea"],["relationship","Relationship","text"],["notes","Notes","textarea"]]},
  "internal-transactions":{title:"Internal group transactions",rows:"internalTransactions",fields:[["transactionDate","Date","date"],["fromEntity","From entity","text"],["toEntity","To entity","text"],["amount","Amount","number"],["transactionType","Type","text"],["notes","Notes","textarea"]]},
  "property-plans":{title:"Property support phases & requirements",rows:"propertyPlans",fields:[["ideaId","Linked idea","ideaOptional"],["propertyName","Property / plan name","text"],["supportType","Support type","text"],["phase","Phase","text"],["requirements","Requirements","textarea"],["estimatedCost","Estimated cost","number"],["monthlySupport","Monthly support","number"],["notes","Notes","textarea"]]},
  "linked-records":{title:"Linked planning records",rows:"linkedRecords",fields:[["ideaId","Growth idea","idea"],["recordType","Record type","text"],["recordId","Record ID / reference","text"],["label","Label","text"],["notes","Notes","textarea"]]},
};
function PlanningEditors({data,save,archive,remove}:{data:Dashboard;save:(type:string,values:any,id?:string)=>Promise<any>;archive:(type:string,id:string,archived:boolean)=>void;remove:(type:string,id:string)=>void}) {
  const [type,setType]=useState("relationships");
  const [values,setValues]=useState<any>({});
  const [editing,setEditing]=useState<string|null>(null);
  const cfg=planningConfig[type], rows=(data as any)[cfg.rows]||[];
  const beginEdit=(row:any)=>{const next:any={};for(const [key] of cfg.fields){const snake=key.replace(/[A-Z]/g,(x:string)=>`_${x.toLowerCase()}`);next[key]=row[snake]??"";}setValues(next);setEditing(row.id)};
  const submit=async()=>{await save(type,values,editing||undefined);setValues({});setEditing(null)};
  return <Card><CardHeader><CardTitle>Detailed owner planning</CardTitle></CardHeader><CardContent className="space-y-4">
    <Tabs value={type} onValueChange={v=>{setType(v);setValues({});setEditing(null)}}><TabsList className="h-auto flex-wrap">{Object.entries(planningConfig).map(([key,c]:any)=><TabsTrigger key={key} value={key}>{c.title}</TabsTrigger>)}</TabsList></Tabs>
    <div className="rounded-xl border bg-slate-50 p-4"><h3 className="mb-3 font-semibold">{editing?"Edit":"Add"} {cfg.title.toLowerCase()}</h3><div className="grid gap-3 md:grid-cols-2">
      {cfg.fields.map(([key,label,kind]:string[])=>{
        if(kind==="idea"||kind==="ideaOptional")return <div key={key}><Label>{label}</Label><Select value={values[key]|| (kind==="ideaOptional"?"none":"")} onValueChange={v=>setValues({...values,[key]:v==="none"?null:v})}><SelectTrigger><SelectValue placeholder="Select an idea"/></SelectTrigger><SelectContent>{kind==="ideaOptional"&&<SelectItem value="none">Not linked</SelectItem>}{data.ideas.filter(x=>!x.archived_at).map(x=><SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></div>;
        return <div key={key} className={kind==="textarea"?"md:col-span-2":""}><Label>{label}</Label>{kind==="textarea"?<Textarea value={values[key]||""} onChange={e=>setValues({...values,[key]:e.target.value})}/>:<Input type={kind} min={kind==="number"?0:undefined} value={values[key]??""} onChange={e=>setValues({...values,[key]:kind==="number"?Number(e.target.value):e.target.value})}/>}</div>
      })}
    </div><div className="mt-3 flex gap-2"><Button onClick={submit}><Plus className="mr-2 h-4 w-4"/>{editing?"Save changes":"Add record"}</Button>{editing&&<Button variant="outline" onClick={()=>{setEditing(null);setValues({})}}>Cancel</Button>}</div></div>
    <div className="space-y-2">{rows.map((row:any)=><div key={row.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${row.archived_at?"opacity-60":""}`}><div><b>{row.name||row.relationship||row.property_name||row.label||`${row.from_entity||""} → ${row.to_entity||""}`}</b>{row.archived_at&&<Badge className="ml-2" variant="secondary">Archived</Badge>}<div className="text-xs text-slate-500">{row.notes||row.requirements||row.transaction_date}</div></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>beginEdit(row)}><Edit3 className="mr-1 h-3 w-3"/>Edit</Button><Button size="sm" variant="outline" onClick={()=>archive(type,row.id,!row.archived_at)}>{row.archived_at?<RotateCcw className="mr-1 h-3 w-3"/>:<Archive className="mr-1 h-3 w-3"/>}{row.archived_at?"Restore":"Archive"}</Button><Button size="icon" variant="ghost" aria-label="Permanently delete planning record" onClick={()=>{if(window.confirm("Permanently delete this planning record? This cannot be undone."))remove(type,row.id)}}><Trash2 className="h-4 w-4 text-red-600"/></Button></div></div>)}</div>
  </CardContent></Card>;
}

export default function GrowthCapital() {
  const { data, isLoading, error } = useQuery<Dashboard>({ queryKey: ["/api/growth-capital/dashboard"] });
  const [idea, setIdea] = useState(emptyIdea);
  const [ideaDialog, setIdeaDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [payment, setPayment] = useState({ paymentDate: new Date().toISOString().slice(0, 10), amount: 0, paymentType: "Normal", notes: "" });
  const [property, setProperty] = useState({ transactionDate: new Date().toISOString().slice(0, 10), amount: 0, transactionType: "Allocation from Terminators", notes: "" });
  const [extraCash, setExtraCash] = useState(200000);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/growth-capital/dashboard"] });
  const createIdea = useMutation({ mutationFn: () => apiRequest("POST", "/api/growth-capital/ideas", idea), onSuccess: () => { setIdea(emptyIdea); refresh(); } });
  const updateIdea = useMutation({ mutationFn: ({ id, values }: any) => apiRequest("PATCH", `/api/growth-capital/ideas/${id}`, values), onSuccess: refresh });
  const deleteIdea = useMutation({ mutationFn: (id: string) => apiRequest("DELETE", `/api/growth-capital/ideas/${id}`), onSuccess: refresh });
  const archiveIdea = useMutation({ mutationFn: ({id,archived}:{id:string;archived:boolean}) => apiRequest("PATCH", `/api/growth-capital/ideas/${id}/archive`, {archived}), onSuccess: refresh });
  const savePlanning = useMutation({ mutationFn: ({type,values,id}:{type:string;values:any;id?:string}) => apiRequest(id?"PATCH":"POST", `/api/growth-capital/planning/${type}${id?`/${id}`:""}`, values), onSuccess: refresh });
  const archivePlanning = useMutation({ mutationFn: ({type,id,archived}:{type:string;id:string;archived:boolean}) => apiRequest("PATCH", `/api/growth-capital/planning/${type}/${id}/archive`, {archived}), onSuccess: refresh });
  const deletePlanning = useMutation({ mutationFn: ({type,id}:{type:string;id:string}) => apiRequest("DELETE", `/api/growth-capital/planning/${type}/${id}`), onSuccess: refresh });
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
  const openNewIdea = () => { setEditingId(null); setIdea({...emptyIdea}); setIdeaDialog(true); };
  const openEditIdea = (row:any) => {
    setEditingId(row.id);
    setIdea({ name:row.name, description:row.description, category:row.category, stage:row.stage,
      setupCost:num(row.setup_cost), monthlyRevenue:num(row.monthly_revenue), monthlyExpenses:num(row.monthly_expenses),
      monthlyCostSaving:num(row.monthly_cost_saving), staffing:row.staffing, propertySpace:row.property_space,
      startDate:row.start_date||"", notes:row.notes, expectedFreeCash:num(row.expected_free_cash),
      propertyFundAllocation:num(row.property_fund_allocation), priorityScore:num(row.priority_score) });
    setIdeaDialog(true);
  };
  const saveIdea = async () => {
    if (!idea.name.trim() || idea.priorityScore < 0 || idea.priorityScore > 35) return;
    if (editingId) await updateIdea.mutateAsync({id:editingId,values:idea});
    else await createIdea.mutateAsync();
    setIdeaDialog(false);
  };
  const IdeaForm = () => <div className="grid gap-4 py-2 sm:grid-cols-2">
    <div><Label>Name *</Label><Input value={idea.name} maxLength={160} onChange={e=>setIdea({...idea,name:e.target.value})}/></div>
    <div><Label>Category *</Label><Input value={idea.category} list="growth-categories" onChange={e=>setIdea({...idea,category:e.target.value})}/><datalist id="growth-categories">{data.categories.filter(x=>!x.archived_at).map(x=><option key={x.id} value={x.name}/>)}</datalist></div>
    <div className="sm:col-span-2"><Label>Description</Label><Textarea value={idea.description} maxLength={5000} onChange={e=>setIdea({...idea,description:e.target.value})}/></div>
    <div><Label>Stage</Label><Select value={idea.stage} onValueChange={stage=>setIdea({...idea,stage})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Idea","Research","Testing","Approved","In Development","Operating"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>Priority score (0–35)</Label><Input type="number" min={0} max={35} value={idea.priorityScore} onChange={e=>setIdea({...idea,priorityScore:Number(e.target.value)})}/></div>
    {[["Setup cost","setupCost"],["Monthly revenue","monthlyRevenue"],["Monthly expenses","monthlyExpenses"],["Monthly cost saving","monthlyCostSaving"],["Expected free cash","expectedFreeCash"],["Property fund allocation","propertyFundAllocation"]].map(([label,key])=><div key={key}><Label>{label}</Label><Input type="number" min={0} value={(idea as any)[key]} onChange={e=>setIdea({...idea,[key]:Number(e.target.value)})}/></div>)}
    <div><Label>Planned start date</Label><Input type="date" value={idea.startDate} onChange={e=>setIdea({...idea,startDate:e.target.value})}/></div>
    <div><Label>Staffing assumptions</Label><Textarea value={idea.staffing} onChange={e=>setIdea({...idea,staffing:e.target.value})}/></div>
    <div className="sm:col-span-2"><Label>Property space / requirements</Label><Textarea value={idea.propertySpace} onChange={e=>setIdea({...idea,propertySpace:e.target.value})}/></div>
    <div className="sm:col-span-2"><Label>Private owner notes</Label><Textarea value={idea.notes} maxLength={5000} onChange={e=>setIdea({...idea,notes:e.target.value})}/></div>
  </div>;

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-2xl font-bold">Future Growth</h2><p className="text-sm text-slate-500">Owner-managed ideas, assumptions and linked planning.</p></div>
          <Button size="lg" onClick={openNewIdea}><Plus className="mr-2 h-5 w-5"/>Add Growth Idea</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Score title="Monthly income" value={rand(data.future.projectedMonthlyRevenue)} icon={TrendingUp}/>
          <Score title="Cost saving" value={rand(data.future.projectedMonthlyCostSaving)} icon={CircleDollarSign}/>
          <Score title="Projected profit" value={rand(data.future.projectedMonthlyProfit)} icon={Target}/>
          <Score title="Capital required" value={rand(data.future.capitalRequired)} icon={Landmark}/>
        </div>
        <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Growth pipeline</CardTitle><Button variant="outline" size="sm" onClick={()=>setShowArchived(!showArchived)}>{showArchived?"Hide archived":"Show archived"}</Button></CardHeader><CardContent className="space-y-3">
          {data.ideas.filter(row=>showArchived||!row.archived_at).map(row => {
            const profit = num(row.monthly_revenue)-num(row.monthly_expenses)+num(row.monthly_cost_saving);
             return <div key={row.id} className={`rounded-xl border p-4 ${row.archived_at?"bg-slate-50 opacity-70":""}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{row.name}</h3>{row.archived_at&&<Badge variant="secondary">Archived</Badge>}</div><p className="mt-1 max-w-3xl text-sm text-slate-600">{row.description}</p><div className="mt-2 flex flex-wrap gap-2"><Badge>{row.category}</Badge><Badge variant="outline">{rand(profit)}/month</Badge><Badge variant="outline">Priority {row.priority_score}/35</Badge></div></div><div className="flex flex-wrap items-center gap-2">{!row.archived_at&&<Select value={row.stage} onValueChange={stage => updateIdea.mutate({id:row.id,values:{stage}})}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent>{["Idea","Research","Testing","Approved","In Development","Operating"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>}<Button variant="outline" onClick={()=>openEditIdea(row)}><Edit3 className="mr-2 h-4 w-4"/>Edit</Button><Button variant="outline" onClick={()=>archiveIdea.mutate({id:row.id,archived:!row.archived_at})}>{row.archived_at?<RotateCcw className="mr-2 h-4 w-4"/>:<Archive className="mr-2 h-4 w-4"/>}{row.archived_at?"Restore":"Archive"}</Button><Button size="icon" variant="ghost" aria-label={`Delete ${row.name}`} onClick={()=>{if(window.confirm(`Permanently delete “${row.name}”? This cannot be undone.`)) deleteIdea.mutate(row.id)}}><Trash2 className="h-4 w-4 text-red-600"/></Button></div></div>{row.notes && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">{row.notes}</p>}</div>;
          })}
        </CardContent></Card>
        <PlanningEditors data={data} save={(type,values,id)=>savePlanning.mutateAsync({type,values,id})} archive={(type,id,archived)=>archivePlanning.mutate({type,id,archived})} remove={(type,id)=>deletePlanning.mutate({type,id})}/>
      </TabsContent>
    </Tabs>
    <Dialog open={ideaDialog} onOpenChange={setIdeaDialog}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editingId?"Edit Growth Idea":"Add Growth Idea"}</DialogTitle><DialogDescription>Update all owner assumptions, financial projections, priorities and private planning notes.</DialogDescription></DialogHeader><IdeaForm/><DialogFooter><Button variant="outline" onClick={()=>setIdeaDialog(false)}>Cancel</Button><Button onClick={saveIdea} disabled={!idea.name.trim()||idea.priorityScore<0||idea.priorityScore>35||createIdea.isPending||updateIdea.isPending}>{editingId?"Save changes":"Create idea"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}