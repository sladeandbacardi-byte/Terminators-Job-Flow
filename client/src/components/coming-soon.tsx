import { Construction } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto mt-20 bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Construction className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
            <p className="text-sm text-gray-500 mb-1">Coming soon</p>
            {description && (
              <p className="text-sm text-gray-600 max-w-md mx-auto mt-3">{description}</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
