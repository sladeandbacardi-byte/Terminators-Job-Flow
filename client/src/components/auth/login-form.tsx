import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, AlertCircle, User } from "lucide-react";
import type { Worker } from "@shared/schema";

interface LoginFormProps {
  onSuccess: (token: string, user: any) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Fetch workers for user selection
  const { data: workers = [], isLoading: workersLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const loginMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        throw new Error("Login failed");
      }
      
      return response.json();
    },
    onSuccess: (data: { token: string; user: any }) => {
      onSuccess(data.token, data.user);
    },
  });

  const handleLogin = () => {
    if (selectedUserId) {
      loginMutation.mutate(selectedUserId);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-600 flex items-center justify-center">
            <User className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            The Terminators
          </CardTitle>
          <CardDescription className="text-gray-600">
            Field Service Management System
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loginMutation.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {loginMutation.error instanceof Error 
                  ? loginMutation.error.message 
                  : "Login failed"}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Select User</Label>
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                disabled={loginMutation.isPending || workersLoading}
              >
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder={workersLoading ? "Loading users..." : "Choose a user to continue"} />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id} data-testid={`user-option-${worker.id}`}>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{worker.name}</p>
                          <p className="text-xs text-gray-500">{worker.role || 'Worker'}</p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleLogin}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loginMutation.isPending || !selectedUserId}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "Signing in..." : "Continue"}
            </Button>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>Select any user to access the system</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}