import { Suspense, type ReactElement } from "react";

import { LoginForm } from "@/app/login/login-form";

export default function LoginPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
