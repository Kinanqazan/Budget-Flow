import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface AuthPageProps {
  registrationAvailable: boolean;
  signIn: (username: string, password: string) => Promise<{ error: unknown }>;
  signUp: (username: string, password: string) => Promise<{ error: unknown }>;
}

const AuthPage = ({ registrationAvailable, signIn, signUp }: AuthPageProps) => {
  const [isLogin, setIsLogin] = useState(!registrationAvailable);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const shouldSignIn = isLogin || !registrationAvailable;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const { error } = shouldSignIn
        ? await signIn(username, password)
        : await signUp(username, password);

      if (error) {
        toast.error(error instanceof Error ? error.message : "Authentication error");
      } else if (shouldSignIn) {
        toast.success("Signed in!");
      } else {
        toast.success("Account created!");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-[22rem] rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-6">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src="/icon-192.svg" alt="BudgetFlow logo" className="h-12 w-12 shrink-0" />
          <h1 className="text-xl font-bold tracking-tight">
            {shouldSignIn ? "Sign in" : "Set up your account"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="flex w-full flex-col items-stretch gap-1.5">
            <label htmlFor="auth-username" className="block w-full text-left text-sm font-medium">Username</label>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={2}
              maxLength={30}
              className="box-border block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none transition focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex w-full flex-col items-stretch gap-1.5">
            <label htmlFor="auth-password" className="block w-full text-left text-sm font-medium">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={shouldSignIn ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="box-border block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none transition focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {shouldSignIn ? <LogIn size={16} /> : <UserPlus size={16} />}
            {submitting
              ? shouldSignIn ? "Signing in..." : "Creating account..."
              : shouldSignIn ? "Sign in" : "Create account"}
          </button>
        </form>

        {registrationAvailable && (
          <div className="mt-4 border-t border-border pt-3 text-center">
            <button
              type="button"
              onClick={() => setIsLogin((current) => !current)}
              className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
            >
              {isLogin ? "First time here? Create the account" : "Already set up? Sign in"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
};

export default AuthPage;
