import { CheckCircle2, Mail, XCircle } from "lucide-react";
import { format } from "date-fns";

type AuditEvent = {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
};

type Delivery = {
  id: string;
  notificationType: "OVERTIME" | "AUTHORISED_TIME_OFF";
  recipient: string;
  status: "sent" | "failed";
  sentAt: string | null;
  attemptedAt: string | null;
  error: string | null;
};

const isDeliveryAction = (action: string) =>
  action === "TIME_NOTIFICATION_SENT" ||
  action === "TIME_NOTIFICATION_FAILED" ||
  action === "TIME_OFF_NOTIFICATION_SENT" ||
  action === "TIME_OFF_NOTIFICATION_FAILED";

function parseDelivery(event: AuditEvent): Delivery | null {
  if (!isDeliveryAction(event.action) || !event.details) return null;
  try {
    const details = JSON.parse(event.details) as Partial<Delivery>;
    if (!details.recipient) return null;
    const status = details.status === "sent" || event.action.endsWith("_SENT") ? "sent" : "failed";
    const notificationType = details.notificationType === "OVERTIME" ? "OVERTIME" : "AUTHORISED_TIME_OFF";
    return {
      id: event.id,
      notificationType,
      recipient: details.recipient,
      status,
      sentAt: details.sentAt || (status === "sent" ? event.createdAt : null),
      attemptedAt: details.attemptedAt || event.createdAt,
      error: details.error || null,
    };
  } catch {
    return null;
  }
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd MMM yyyy, HH:mm");
  } catch {
    return value;
  }
}

export function EmailNotificationDetails({ audit }: { audit: AuditEvent[] }) {
  const deliveries = audit.map(parseDelivery).filter((delivery): delivery is Delivery => Boolean(delivery));

  return (
    <section className="mt-5 border-t border-gray-200 pt-4" aria-label="Email notifications">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-gray-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Email notifications</h3>
      </div>
      {deliveries.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No recipient-level notification records are available for this entry.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {deliveries.map(delivery => (
            <div key={delivery.id} className={`rounded-lg border p-3 ${delivery.status === "sent" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-start gap-2">
                {delivery.status === "sent" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="break-all text-sm font-medium text-gray-900">{delivery.recipient}</p>
                    <span className={`text-xs font-semibold uppercase ${delivery.status === "sent" ? "text-emerald-700" : "text-red-700"}`}>
                      {delivery.status === "sent" ? "Sent" : "Failed"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {delivery.notificationType === "OVERTIME" ? "Overtime" : "Authorised Time Off"} ·{" "}
                    {delivery.status === "sent" ? `Sent ${formatTimestamp(delivery.sentAt)}` : `Attempted ${formatTimestamp(delivery.attemptedAt)}`}
                  </p>
                  {delivery.status === "failed" && delivery.error && (
                    <p className="mt-1 break-words text-xs text-red-700">Provider error: {delivery.error}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}