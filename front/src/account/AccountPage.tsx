import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { useAuth } from "../auth/AuthContext";
import { isStrongPassword } from "../utils/formUtils";

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ||
  "http://localhost:3001";

// Funcao responsavel por exibir e atualizar os dados da conta logada, incluindo alteracao opcional de senha.
export default function AccountPage() {
  const { accessToken, user, updateSession } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  useEffect(() => {
    let mounted = true;

    // Funcao responsavel por carregar os dados atuais do perfil autenticado para preencher o formulario.
    const loadProfile = async () => {
      if (!accessToken) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
        });

        const data = await res.json();

        if (!mounted) return;

        if (!res.ok) {
          setError(data.message || "Não foi possível carregar seus dados.");
          return;
        }

        setNome(String(data.user?.name || ""));
        setEmail(String(data.user?.email || ""));
        setTelefone(String(data.user?.telefone || ""));
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Não foi possível carregar seus dados.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const canSave = useMemo(() => {
    if (!nome.trim() || !email.trim()) return false;
    if (senha && !isStrongPassword(senha)) return false;
    if (senha && senha.length < 6) return false;
    if (senha !== confirmarSenha) return false;
    return true;
  }, [nome, email, senha, confirmarSenha]);

  // Funcao responsavel por validar o formulario e persistir as alteracoes de perfil no backend.
  const handleSave = async () => {
    if (!accessToken) return;

    setError(null);
    setSuccess(null);

    if (senha !== confirmarSenha) {
      setError("A confirmação de senha não confere.");
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, string | null> = {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim() || null,
      };

      if (senha.trim()) {
        payload.senha = senha.trim();
      }

      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Não foi possível atualizar os dados.");
        return;
      }

      if (data.user) {
        updateSession({ user: data.user, accessToken: data.accessToken || accessToken });
      }

      setSenha("");
      setConfirmarSenha("");
      setSuccess(data.message || "Dados atualizados com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar os dados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }} className="fade-in-page">
        <Typography variant="h4" component="h1" sx={{ mb: 0.5 }}>
          Minha conta
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Atualize seus dados cadastrais.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {loading ? (
          <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            <TextField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} fullWidth />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField
              label="Telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              fullWidth
            />
            <TextField
              label="Nova senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              fullWidth
              helperText="Preencha apenas se quiser alterar a senha."
            />

            <Box sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Requisitos da senha:
              </Typography>
              <List dense>
                <ListItem disablePadding>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {senha.length >= 6 ? (
                      <CheckCircleIcon sx={{ color: 'success.main' }} fontSize="small" />
                    ) : (
                      <CancelIcon sx={{ color: 'error.main' }} fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText primary="Mínimo 6 caracteres" primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {/[a-z]/.test(senha) ? (
                      <CheckCircleIcon sx={{ color: 'success.main' }} fontSize="small" />
                    ) : (
                      <CancelIcon sx={{ color: 'error.main' }} fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText primary="Letra minúscula" primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {/[A-Z]/.test(senha) ? (
                      <CheckCircleIcon sx={{ color: 'success.main' }} fontSize="small" />
                    ) : (
                      <CancelIcon sx={{ color: 'error.main' }} fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText primary="Letra maiúscula" primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {/\d/.test(senha) ? (
                      <CheckCircleIcon sx={{ color: 'success.main' }} fontSize="small" />
                    ) : (
                      <CancelIcon sx={{ color: 'error.main' }} fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText primary="Número" primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {/[^A-Za-z\d]/.test(senha) ? (
                      <CheckCircleIcon sx={{ color: 'success.main' }} fontSize="small" />
                    ) : (
                      <CancelIcon sx={{ color: 'error.main' }} fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText primary="Símbolo especial" primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
              </List>
            </Box>
            <TextField
              label="Confirmar nova senha"
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              fullWidth
            />
            <Button variant="contained" color="secondary" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </Stack>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
          Perfil: {user?.role === "barbeiro" ? "Barbeiro" : "Cliente"}
        </Typography>
      </Paper>
    </Container>
  );
}
