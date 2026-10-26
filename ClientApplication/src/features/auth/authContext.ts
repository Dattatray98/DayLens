import { createContext } from "react";
import type { LocalAccount } from "./authService";

export interface AuthContextValue {
  account: LocalAccount | null;
  loading: boolean;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
