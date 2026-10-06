import { useState } from "react";
import { LogIn, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { ApiUser } from "@/types/api";

interface AuthBarProps {
  user: ApiUser | null;
  username: string;
  loading: boolean;
  authEnabled: boolean;
  registrationAvailable: boolean;
  onOpenSettings: () => void;
  signIn: (username: string, password: string) => Promise<{ error: unknown }>;
  signUp: (username: string, password: string) => Promise<{ error: unknown }>;
}

const AuthBar = ({ user, username, loading, authEnabled, registrationAvailable, onOpenSettings, signIn, signUp }: AuthBarProps) => {
  const [showForm, setShowForm] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (loading) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const shouldSignIn = isLogin || !registrationAvailable;
    try {
      const { error } = shouldSignIn
        ? await signIn(usernameInput, password)
        : await signUp(usernameInput, password);
      if (error) {
        const message = error instanceof Error ? error.message : "Authentication error";
        toast.error(message);
      } else {
        if (shouldSignIn) {
          toast.success("Signed in!");
          setShowForm(false);
        } else {
          toast.success("Registration successful! You are now logged in.");
          setIsLogin(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (user) {
    return (
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-sm font-bold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors shrink-0"
        title="Open settings"
        aria-label={`Open settings for ${username}`}
      >
        {username.trim().charAt(0).toUpperCase() || "?"}
      </button>
    );
  }

  if (!authEnabled) return null;

  return (
    <div className="relative shrink-0 flex items-center">
      {/* Sign In Button */}
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity h-8 w-8 shrink-0 shadow-sm"
        title="Sign In"
      >
        <LogIn size={14} />
      </button>
      {showForm && (
        <>
          {/* Backdrop to close when clicking outside */}
          <div 
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" 
            onClick={() => setShowForm(false)}
          />
          <div className="absolute right-0 top-11 mt-1 bg-card border border-border/90 rounded-2xl shadow-xl p-4 z-50 w-72 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
              <span className="font-bold text-xs text-foreground">
                {isLogin || !registrationAvailable ? "Sign In to Account" : "Register Account"}
              </span>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-accent transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                  minLength={2}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block block">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {isLogin || !registrationAvailable ? <LogIn size={13} /> : <UserPlus size={13} />}
                {submitting ? "Authenticating..." : isLogin || !registrationAvailable ? "Login" : "Register"}
              </button>
            </form>

            {registrationAvailable && (
              <div className="pt-2 border-t border-border/40 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
                >
                  {isLogin ? "Need an account? Register" : "Already have an account? Login"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AuthBar;
