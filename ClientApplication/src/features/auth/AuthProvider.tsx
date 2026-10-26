import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { loginAccount, logoutAccount, registerAccount, restoreLocalSession, sessionChangeEvent, type LocalAccount } from "./authService";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    restoreLocalSession()
      .then((restored) => { if (active) setAccount(restored); })
      .catch(() => { if (active) setAccount(null); })
      .finally(() => { if (active) setLoading(false); });
    const syncSession = () => {
      void restoreLocalSession().then(setAccount).catch(() => setAccount(null));
    };
    window.addEventListener(sessionChangeEvent, syncSession);
    return () => {
      active = false;
      window.removeEventListener(sessionChangeEvent, syncSession);
    };
  }, []);

  const register = useCallback(async (email: string, password: string) => setAccount(await registerAccount(email, password)), []);
  const login = useCallback(async (email: string, password: string) => setAccount(await loginAccount(email, password)), []);
  const logout = useCallback(() => { logoutAccount(); setAccount(null); }, []);
  const value = useMemo(() => ({ account, loading, register, login, logout }), [account, loading, register, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

