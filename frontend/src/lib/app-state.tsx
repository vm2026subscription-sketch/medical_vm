import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiClientError,
  apiRequest,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./api-client";

interface User {
  id: string;
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  role: "student" | "admin";
}

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  requestOtp: (phone: string) => Promise<{ sent: boolean }>;
  verifyOtp: (phone: string, code: string, name?: string) => Promise<void>;
  requestEmailOtp: (email: string) => Promise<{ sent: boolean }>;
  verifyEmailOtp: (email: string, code: string, name?: string) => Promise<void>;
  logout: () => void;

  // Premium — hydrated from the real subscription check once logged in; the local
  // `premium` flag stays in sync so components can keep reading it exactly as before.
  premium: boolean;
  refreshPremiumStatus: () => Promise<void>;

  saved: string[];
  toggleSaved: (id: string) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  studentName: string;
  rank: number | null;
  setRank: (r: number | null) => void;
}

const Ctx = createContext<AppState | null>(null);

const KEY = "medpath.state.v1";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [premium, setPremium] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [rank, setRank] = useState<number | null>(null);

  const refreshPremiumStatusInternal = useCallback(async () => {
    try {
      const res = await apiRequest<{
        data: { isPremium: boolean; savedCollegeIds?: string[] };
      }>("/dashboard/overview");
      if (!getAccessToken()) return;
      setPremium(!!res.data.isPremium);
      if (res.data.savedCollegeIds) setSaved(res.data.savedCollegeIds);
    } catch {
      setPremium(false);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const res = await apiRequest<{
        data: { user: User & { _id: string }; profile: { neetRank?: number } | null };
      }>("/profile/me");
      if (!getAccessToken()) return;
      setUser({
        id: res.data.user._id,
        name: res.data.user.name,
        phone: res.data.user.phone,
        email: res.data.user.email,
        role: res.data.user.role,
      });
      if (typeof res.data.profile?.neetRank === "number") setRank(res.data.profile.neetRank);
      await refreshPremiumStatusInternal();
    } catch (error) {
      // Token invalid/expired and refresh already failed inside apiRequest — clear and
      // fall back to a logged-out state rather than leaving stale UI.
      if (error instanceof ApiClientError && error.status === 401) clearTokens();
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [refreshPremiumStatusInternal]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<AppState>;
        if (Array.isArray(p.saved)) setSaved(p.saved);
        if (Array.isArray(p.compare)) setCompare(p.compare);
        if (typeof p.rank === "number") setRank(p.rank);
      }
    } catch {
      /* ignore */
    }

    if (getAccessToken() || getRefreshToken()) {
      restoreSession();
    } else setAuthLoading(false);
    const clearSession = () => {
      setUser(null);
      setPremium(false);
      setSaved([]);
      setRank(null);
    };
    const syncSession = (event: StorageEvent) => {
      if (event.key === "medpath.accessToken" || event.key === null) {
        if (getAccessToken()) void restoreSession();
        else clearSession();
      }
    };
    window.addEventListener("medpath:logout", clearSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener("medpath:logout", clearSession);
      window.removeEventListener("storage", syncSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ saved, compare, rank }));
    } catch {
      /* ignore */
    }
  }, [saved, compare, rank]);

  const requestOtp = useCallback(async (phone: string) => {
    const res = await apiRequest<{ data: { sent: boolean } }>(
      "/auth/otp/request",
      {
        method: "POST",
        body: { phone },
        auth: false,
      },
    );
    return res.data;
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string, name?: string) => {
      const res = await apiRequest<{
        data: { user: User; accessToken: string; refreshToken: string };
      }>("/auth/otp/verify", { method: "POST", body: { phone, code, name }, auth: false });
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser({
        id: res.data.user.id,
        name: res.data.user.name,
        phone: res.data.user.phone,
        role: res.data.user.role,
      });
      await refreshPremiumStatusInternal();
    },
    [refreshPremiumStatusInternal],
  );

  const requestEmailOtp = useCallback(async (email: string) => {
    const res = await apiRequest<{ data: { sent: boolean } }>(
      "/auth/email-otp/request",
      {
        method: "POST",
        body: { email },
        auth: false,
      },
    );
    return res.data;
  }, []);

  const verifyEmailOtp = useCallback(
    async (email: string, code: string, name?: string) => {
      const res = await apiRequest<{
        data: { user: User; accessToken: string; refreshToken: string };
      }>("/auth/email-otp/verify", { method: "POST", body: { email, code, name }, auth: false });
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser({
        id: res.data.user.id,
        name: res.data.user.name,
        email: res.data.user.email,
        role: res.data.user.role,
      });
      await refreshPremiumStatusInternal();
    },
    [refreshPremiumStatusInternal],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setPremium(false);
  }, []);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const toggleSaved = useCallback(
    (id: string) =>
      setSaved((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    [],
  );
  const toggleCompare = useCallback(
    (id: string) =>
      setCompare((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    [],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      authLoading,
      requestOtp,
      verifyOtp,
      requestEmailOtp,
      verifyEmailOtp,
      logout,
      premium,
      refreshPremiumStatus: refreshPremiumStatusInternal,
      saved,
      toggleSaved,
      compare,
      toggleCompare,
      studentName: user?.name || "Guest",
      rank,
      setRank,
    }),
    [
      user,
      authLoading,
      requestOtp,
      verifyOtp,
      requestEmailOtp,
      verifyEmailOtp,
      logout,
      premium,
      refreshPremiumStatusInternal,
      saved,
      toggleSaved,
      compare,
      toggleCompare,
      rank,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
