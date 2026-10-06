import { useState, useEffect } from "react";
import type { ApiUser } from "@/types/api";
import { api, TOKEN_KEY } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string>("");
  const [authEnabled, setAuthEnabled] = useState(true);
  const [registrationAvailable, setRegistrationAvailable] = useState(false);

  useEffect(() => {
    api.auth.setupStatus().then((status) => {
      setAuthEnabled(status.authEnabled);
      setRegistrationAvailable(status.authEnabled && status.needsSetup);

      if (!status.authEnabled) {
        setUser({ id: "default", username: "admin" });
        setUsername("admin");
        setLoading(false);
        return;
      }

      if (status.needsSetup) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }

      api.auth.me()
        .then((u) => {
          setUser(u);
          setUsername(u.username);
        })
        .catch(() => api.clearToken())
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const { token, user: u } = await api.auth.login(username, password);
      api.setToken(token);
      setUser(u);
      setUsername(u.username);
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  const signUp = async (username: string, password: string) => {
    try {
      const { token, user: u } = await api.auth.register(username, password);
      api.setToken(token);
      setUser(u);
      setUsername(u.username);
      setRegistrationAvailable(false);
      return { error: null };
    } catch (e: any) {
      api.auth.setupStatus().then((status) => {
        setRegistrationAvailable(status.authEnabled && status.needsSetup);
      }).catch(() => {});
      return { error: e };
    }
  };

  const signOut = async () => {
    api.clearToken();
    setUser(null);
    setUsername("");
  };

  const deleteAccount = async () => {
    await api.auth.deleteAccount();
    api.clearToken();
    setUser(null);
    setUsername("");
    try {
      const status = await api.auth.setupStatus();
      setRegistrationAvailable(status.authEnabled && status.needsSetup);
    } catch {
      setRegistrationAvailable(false);
    }
  };

  return { user, loading, username, authEnabled, registrationAvailable, signIn, signUp, signOut, deleteAccount };
}
