import { useEffect } from "react";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router";
import SignInSide from "./login/SignInSide";
import Dashboard from "./dashboard/Dashboard";
import CrudDashboard from "./crud-dashboard/CrudDashboard";
import SideBar from "./SideBar/SideBar";
import SchedulePage from "./schedule/SchedulePage";
import ReservationsHistoryPage from "./history/ReservationsHistoryPage";
import AccountPage from "./account/AccountPage";
import AppTheme from "./shared-theme/AppTheme";
import { AuthProvider, useAuth } from "./auth/AuthContext";

// Funcao responsavel por converter o indice da aba de CRUD na rota correspondente da aplicacao.
function tabToCrudPath(tab: number) {
  switch (Number(tab)) {
    case 1:
      return "/crud/barbeiros";
    case 2:
      return "/crud/especialidades";
    case 3:
      return "/crud/servicos";
    default:
      return "/crud/clientes";
  }
}

// Funcao responsavel por identificar a visao principal ativa a partir da URL atual.
function getCurrentView(pathname: string) {
  if (pathname.startsWith("/crud")) return "crud";
  if (pathname.startsWith("/schedule")) return "schedule";
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/account")) return "account";
  return "dashboard";
}

// Funcao responsavel por identificar qual aba de CRUD deve ficar selecionada com base no caminho atual.
function getCurrentCrudTab(pathname: string) {
  if (pathname.startsWith("/crud/barbeiros")) return 1;
  if (pathname.startsWith("/crud/especialidades")) return 2;
  if (pathname.startsWith("/crud/servicos")) return 3;
  return 0;
}

// Funcao responsavel por controlar restauracao de sessao, permissoes de rota e renderizacao do layout autenticado.
function AppContent() {
  const { user, isRestoring } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isCliente = user?.role === "cliente";
  const isBarberAdmin = user?.role === "barbeiro" && user?.admin === true;

  const canAccessSchedule = !!user && isCliente;
  const canAccessHistory = !!user && !isCliente;
  const canAccessCrud = !!user && isBarberAdmin;

  useEffect(() => {
    if (!user) return;

    const path = location.pathname;
    if (path === "/schedule" && !canAccessSchedule) {
      navigate("/dashboard");
    } else if (path === "/history" && !canAccessHistory) {
      navigate("/dashboard");
    } else if (path.startsWith("/crud") && !canAccessCrud) {
      navigate("/dashboard");
    }
  }, [location.pathname, user, canAccessSchedule, canAccessHistory, canAccessCrud, navigate]);

  if (isRestoring) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Stack alignItems="center" spacing={1.5} className="fade-in-page">
          <CircularProgress className="soft-pulse" thickness={4.5} />
          <Typography variant="body2" color="text.secondary">
            Carregando sua sessao...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (!user) {
    return <SignInSide onLoginSuccess={() => navigate("/dashboard")} />;
  }

  // Funcao responsavel por receber o resultado da tela de agendamento e registrar o retorno para depuracao.
  const handleScheduleResult = (notice: unknown) => {
    console.log("Schedule result:", notice);
  };

  const currentView = getCurrentView(location.pathname);
  const currentCrudTab = getCurrentCrudTab(location.pathname);

  // Funcao responsavel por navegar entre visoes principais da aplicacao a partir da interacao na barra lateral.
  const handleSelectView = (nextView: string) => {
    if (nextView === "dashboard") {
      navigate("/dashboard");
      return;
    }

    if (nextView === "crud") {
      navigate("/crud/clientes");
      return;
    }

    navigate(`/${nextView}`);
  };

  // Funcao responsavel por atualizar a rota para a aba de CRUD escolhida pelo usuario.
  const handleSelectCrudTab = (tab: number) => {
    navigate(tabToCrudPath(tab));
  };

  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        overflowY: { xs: "auto", md: "visible" },
        minHeight: { xs: "100dvh", md: "100vh" },
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      <SideBar
        currentView={currentView}
        currentTab={currentCrudTab}
        onSelectView={handleSelectView}
        onSelectTab={handleSelectCrudTab}
        onOpenAccount={() => navigate("/account")}
      />
      <Box sx={{ flex: 1, minWidth: 0, width: "100%", maxWidth: "100%", overflowX: "hidden", overflowY: { xs: "auto", md: "visible" } }}>
        <Box className="fade-in-page">
          <Routes>
            <Route path="/dashboard" element={<Dashboard onOpenSchedulePage={() => navigate("/schedule")} />} />
            <Route path="/schedule" element={canAccessSchedule ? <SchedulePage onBackHome={() => navigate("/dashboard")} onScheduleResult={handleScheduleResult} /> : <Navigate to="/dashboard" />} />
            <Route path="/crud" element={<Navigate to="/crud/clientes" />} />
            <Route path="/crud/clientes" element={canAccessCrud ? <CrudDashboard initialTab={0} onTabChange={handleSelectCrudTab} /> : <Navigate to="/dashboard" />} />
            <Route path="/crud/barbeiros" element={canAccessCrud ? <CrudDashboard initialTab={1} onTabChange={handleSelectCrudTab} /> : <Navigate to="/dashboard" />} />
            <Route path="/crud/especialidades" element={canAccessCrud ? <CrudDashboard initialTab={2} onTabChange={handleSelectCrudTab} /> : <Navigate to="/dashboard" />} />
            <Route path="/crud/servicos" element={canAccessCrud ? <CrudDashboard initialTab={3} onTabChange={handleSelectCrudTab} /> : <Navigate to="/dashboard" />} />
            <Route path="/history" element={canAccessHistory ? <ReservationsHistoryPage /> : <Navigate to="/dashboard" />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

// Funcao responsavel por encapsular a aplicacao com tema global, baseline de estilos e contexto de autenticacao.
export default function App() {
  return (
    <AppTheme>
      <CssBaseline enableColorScheme />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppTheme>
  );
}
