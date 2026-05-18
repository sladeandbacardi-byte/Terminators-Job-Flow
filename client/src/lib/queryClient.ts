import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// All write methods are blocked in demo mode — the demo is read-only
const DEMO_WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function isDemoMode(): boolean {
  return localStorage.getItem("demo_mode") === "true";
}

function checkDemoBlock(method: string, _url: string): void {
  if (!isDemoMode()) return;
  if (DEMO_WRITE_METHODS.has(method.toUpperCase())) {
    toast({
      title: "Demo Mode",
      description: "This action is disabled in Demo Mode.",
      variant: "destructive",
    });
    throw new Error("This action is disabled in Demo Mode.");
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const errorData = await res.json();
      errorMessage = errorData.details || errorData.error || errorMessage;
    } catch (e) {
      try {
        errorMessage = (await res.text()) || errorMessage;
      } catch (textError) {
        // Fallback to statusText
      }
    }
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Block destructive actions in demo mode
  checkDemoBlock(method, url);

  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {};

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
