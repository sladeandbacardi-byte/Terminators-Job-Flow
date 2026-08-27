import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

interface FinanceBreadcrumbProps {
  section?: "Income" | "Expenses";
  current: string;
}

export function FinanceBreadcrumb({ section, current }: FinanceBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" data-testid="finance-breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-xs text-gray-500">
        <li>
          <Link href="/finance-dashboard" className="hover:text-gray-900 transition-colors">
            Finance
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3 w-3 text-gray-300" />
        </li>
        {section && (
          <>
            <li>{section}</li>
            <li aria-hidden="true">
              <ChevronRight className="h-3 w-3 text-gray-300" />
            </li>
          </>
        )}
        <li aria-current="page" className="font-medium text-gray-700">
          {current}
        </li>
      </ol>
    </nav>
  );
}