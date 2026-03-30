import * as React from 'react';

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ||
  'http://localhost:3001';

const REFRESH_BEFORE_MS = 60 * 1000;
const MIN_REFRESH_MS = 5 * 1000;

// Funcao responsavel por calcular quantos milissegundos faltam para o access token expirar a partir do campo exp do JWT.
function msUntilExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return 0;
    return payload.exp * 1000 - Date.now();
  } catch {
    return 0;
  }
}

type User = {
  id: number;
  name: string;
  email: string;
  telefone?: string | null;
  role: 'cliente' | 'barbeiro';
  admin?: boolean;
};

type AuthContextType = {
  accessToken: string | null;
  user: User | null;
  isRestoring: boolean;
  login: (email: string, senha: string) => Promise<{ ok: boolean; message?: string }>;
  registerCliente: (payload: {
    nome: string;
    email: string;
    telefone?: string | null;
    senha: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateSession: (next: { user: User; accessToken?: string | null }) => void;
};

const AuthContext = React.createContext<AuthContextType | null>(null);

// Funcao responsavel por manter estado global de autenticacao, gerenciar refresh silencioso e expor acoes de sessao.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [isRestoring, setIsRestoring] = React.useState(true);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Funcao responsavel por limpar o timer de refresh anterior e evitar multiplos agendamentos concorrentes.
  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const silentRefresh = React.useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // envia o cookie httpOnly automaticamente
      });

      if (!res.ok) {
        setAccessToken(null);
        setUser(null);
        return false;
      }

      const data = await res.json();
      setAccessToken(data.accessToken);
      setUser(data.user);

      const delay = Math.max(msUntilExpiry(data.accessToken) - REFRESH_BEFORE_MS, MIN_REFRESH_MS);
      clearTimer();
      timerRef.current = setTimeout(silentRefresh, delay);
      return true;
    } catch {
      setAccessToken(null);
      setUser(null);
      return false;
    }
  }, []);

  React.useEffect(() => {
    silentRefresh().finally(() => setIsRestoring(false));
    return clearTimer;
  }, [silentRefresh]);

  // Funcao responsavel por autenticar o usuario via API, armazenar sessao em memoria e agendar renovacao automatica do token.
  const login = async (email: string, senha: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: normalizedEmail, usuario: normalizedEmail, senha }),
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.message as string };

    setAccessToken(body.accessToken);
    setUser(body.user);

    const delay = Math.max(msUntilExpiry(body.accessToken) - REFRESH_BEFORE_MS, MIN_REFRESH_MS);
    clearTimer();
    timerRef.current = setTimeout(silentRefresh, delay);
    return { ok: true };
  };

  const registerCliente = async (payload: {
    nome: string;
    email: string;
    telefone?: string | null;
    senha: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/auth/register-cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.message as string };

    setAccessToken(body.accessToken);
    setUser(body.user);

    const delay = Math.max(msUntilExpiry(body.accessToken) - REFRESH_BEFORE_MS, MIN_REFRESH_MS);
    clearTimer();
    timerRef.current = setTimeout(silentRefresh, delay);
    return { ok: true };
  };

  // Funcao responsavel por encerrar a sessao no servidor e limpar os dados locais de autenticacao.
  const logout = async () => {
    clearTimer();
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    setAccessToken(null);
    setUser(null);
  };

  // Funcao responsavel por atualizar os dados da sessao apos alteracoes de perfil, com novo token quando disponivel.
  const updateSession = ({ user: nextUser, accessToken: nextAccessToken }: { user: User; accessToken?: string | null }) => {
    setUser(nextUser);
    if (typeof nextAccessToken === 'string') {
      setAccessToken(nextAccessToken);

      const delay = Math.max(msUntilExpiry(nextAccessToken) - REFRESH_BEFORE_MS, MIN_REFRESH_MS);
      clearTimer();
      timerRef.current = setTimeout(silentRefresh, delay);
    }
  };

  return (
    <AuthContext.Provider value={{ accessToken, user, isRestoring, login, registerCliente, logout, updateSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// Funcao responsavel por fornecer acesso seguro ao contexto de autenticacao e impedir uso fora do provider.
export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
