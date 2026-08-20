import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Clock3 } from "lucide-react";
import { Link } from "wouter";
import { PrintableJobCard } from "@/components/job-card";

export default function JobCardPage() {
  const { id } = useParams<{ id: string }>();
  
  if (!id) {
    return (
    <>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Job Card Not Found</h1>
          <Link href="/jobs">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </Link>
        </div>
      </div>
    </>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="job-card-page">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap justify-between items-center gap-3 max-w-4xl mx-auto">
          <Link href="/jobs">
            <Button variant="outline" data-testid="button-back-jobs">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/my-overtime?job=${encodeURIComponent(id)}`}>
              <Button variant="outline" data-testid="button-log-overtime">
                <Clock3 className="h-4 w-4 mr-2" />
                Log Overtime
              </Button>
            </Link>
            <Button onClick={handlePrint} data-testid="button-print-card">
              <Printer className="h-4 w-4 mr-2" />
              Print Job Card
            </Button>
          </div>
        </div>
      </div>

      {/* Job Card Content */}
      <div className="p-6 print:p-0">
        <PrintableJobCard jobId={id} />
      </div>
    </div>
  );
}