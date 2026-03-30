import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Snackbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTheme } from '@mui/material/styles';
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { formatPhoneBR, isStrongPassword, isValidEmail, normalizeUiError } from '../utils/formUtils';

interface ClienteData {
  id_cliente?: number;
  nome: string;
  email: string;
  telefone?: string;
  senha?: string;
}

// Funcao responsavel por gerenciar o CRUD de clientes, incluindo listagem, formulario de edicao e exclusao.
export default function ClientesCrud() {
  const { request } = useApi();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteData | null>(null);
  const [formData, setFormData] = useState<ClienteData>({
    nome: '',
    email: '',
    telefone: '',
  });

  const senhaAtual = formData.senha || '';
  const senhaChecks = {
    minLen: senhaAtual.length >= 6,
    hasLower: /[a-z]/.test(senhaAtual),
    hasUpper: /[A-Z]/.test(senhaAtual),
    hasNumber: /\d/.test(senhaAtual),
    hasSymbol: /[^A-Za-z\d]/.test(senhaAtual),
  };

  const isBarberAdmin = user?.role === 'barbeiro' && user?.admin === true;

  // Funcao responsavel por consultar a lista de clientes no backend e atualizar os dados da tabela.
  const loadClientes = async () => {
    setLoading(true);
    setError(null);

    const res = await request('/clientes', { method: 'GET' });

    if (res.ok && Array.isArray(res.data?.clientes)) {
      setClientes(res.data.clientes);
    } else {
      setClientes([]);
      setError(res.message || 'Não foi possível carregar clientes');
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isBarberAdmin) {
      setError('Apenas barbeiro admin pode gerenciar clientes');
      return;
    }

    loadClientes();
  }, [isBarberAdmin]);

  // Funcao responsavel por abrir o dialogo de criacao/edicao preenchendo o formulario com os dados atuais quando houver selecao.
  const handleOpenDialog = (cliente?: ClienteData) => {
    if (cliente) {
      setSelectedCliente(cliente);
      setFormData(cliente);
    } else {
      setSelectedCliente(null);
      setFormData({ nome: '', email: '', telefone: '' });
    }
    setOpenDialog(true);
  };

  // Funcao responsavel por fechar o dialogo e limpar estados de erro/sucesso relacionados ao formulario.
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({ nome: '', email: '', telefone: '' });
  };

  // Funcao responsavel por validar os campos e salvar cliente novo ou alterado via API.
  const handleSave = async () => {
    if (!isBarberAdmin) {
      setError('Permissão negada');
      return;
    }

    setError(null);
    setSuccess(null);

    if (!formData.nome || !formData.email) {
      setError('Nome e email são obrigatórios.');
      return;
    }

    if (!isValidEmail(formData.email)) {
      setError('Email inválido. Informe um email válido.');
      return;
    }

    if (formData.telefone && formData.telefone.replace(/\D/g, '').length < 10) {
      setError('Telefone inválido. Informe DDD e número com 10 ou 11 dígitos.');
      return;
    }

    const payload: Record<string, string | null> = {
      nome: formData.nome,
      email: formData.email,
      telefone: formData.telefone || null,
    };

    if (!selectedCliente) {
      if (!formData.senha) {
        setError('Senha é obrigatória para novo cliente.');
        return;
      }
      if (!isStrongPassword(formData.senha)) {
        setError('A senha deve conter ao menos 6 caracteres com maiúscula, minúscula, número e símbolo.');
        return;
      }
      payload.senha = formData.senha;
    } else if (formData.senha) {
      if (!isStrongPassword(formData.senha)) {
        setError('A senha deve conter ao menos 6 caracteres com maiúscula, minúscula, número e símbolo.');
        return;
      }
      payload.senha = formData.senha;
    }

    setLoading(true);
    const res = selectedCliente
      ? await request(`/clientes/${selectedCliente.id_cliente}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      : await request('/clientes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

    setLoading(false);

    if (res.ok) {
      setSuccess(selectedCliente ? 'Cliente atualizado com sucesso!' : 'Cliente criado com sucesso!');
      handleCloseDialog();
      loadClientes();
    } else {
      setError(normalizeUiError(res.message || 'Erro ao processar requisição.'));
    }
  };

  // Funcao responsavel por confirmar e remover o cliente selecionado, recarregando a listagem apos a operacao.
  const handleDelete = async (cliente: ClienteData) => {
    if (!isBarberAdmin) {
      setError('Permissão negada');
      return;
    }

    if (!cliente.id_cliente) {
      return;
    }

    const confirmed = window.confirm(`Tem certeza que deseja excluir o cliente ${cliente.nome}?`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await request(`/clientes/${cliente.id_cliente}`, {
      method: 'DELETE',
    });

    setLoading(false);

    if (res.ok) {
      setSuccess('Cliente excluído com sucesso!');
      loadClientes();
      return;
    }

    setError(normalizeUiError(res.message || 'Erro ao excluir cliente.'));
  };

  // Funcao responsavel por dispensar mensagens de feedback exibidas na tela.
  const handleCloseFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  if (!isBarberAdmin) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">
          Apenas barbeiro admin pode gerenciar clientes
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <h2>Gerenciar Clientes</h2>
        <Button
          variant="contained"
          color="secondary"
          size="small"
          startIcon={<AddIcon />}
          sx={{
            px: 1.2,
            py: 0.35,
            minHeight: 30,
            fontSize: '0.74rem',
            '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inline-flex' } },
          }}
          onClick={() => handleOpenDialog()}
        >
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' }, lineHeight: 1 }}>
            +
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Novo Cliente
          </Box>
        </Button>
      </Box>

      <Snackbar
        open={Boolean(error) && !openDialog}
        autoHideDuration={5000}
        onClose={handleCloseFeedback}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 30000 }}
      >
        <Alert onClose={handleCloseFeedback} severity="error" sx={{ width: '100%', zIndex: 30001 }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar
        open={Boolean(success) && !openDialog}
        autoHideDuration={3500}
        onClose={handleCloseFeedback}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 30000 }}
      >
        <Alert onClose={handleCloseFeedback} severity="success" sx={{ width: '100%', zIndex: 30001 }}>
          {success}
        </Alert>
      </Snackbar>

      {loading && <CircularProgress />}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#01325f', '& .MuiTableCell-head': { color: '#ffffff' } }}>
              <TableCell>Nome</TableCell>
              {!isMobile && <TableCell align="right">Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {clientes.map((cliente) => (
              <TableRow key={cliente.id_cliente}>
                <TableCell>
                  {isMobile ? (
                    <Button
                      variant="text"
                      color="inherit"
                      sx={{ textTransform: 'none', fontWeight: 700, p: 0, minWidth: 0 }}
                      onClick={() => handleOpenDialog(cliente)}
                    >
                      {cliente.nome}
                    </Button>
                  ) : (
                    <Box sx={{ fontWeight: 700 }}>{cliente.nome}</Box>
                  )}
                </TableCell>
                {!isMobile && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" variant="outlined" onClick={() => handleOpenDialog(cliente)}>
                      Editar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedCliente ? 'Editar Cliente' : 'Novo Cliente'}
        </DialogTitle>
        <DialogContent sx={{ pt: '32px !important', mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <Alert severity="error" onClose={handleCloseFeedback}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={handleCloseFeedback}>
              {success}
            </Alert>
          )}
          <TextField
            label="Nome"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value.trimStart().toLowerCase() })}
            fullWidth
          />
          <TextField
            label="Telefone"
            value={formData.telefone}
            onChange={(e) => setFormData({ ...formData, telefone: formatPhoneBR(e.target.value) })}
            fullWidth
          />
          <TextField
            label={selectedCliente ? 'Nova senha (opcional)' : 'Senha'}
            type="password"
            value={formData.senha || ''}
            onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
            fullWidth
          />
          <Box
            sx={{
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.8, fontWeight: 700 }}>
              Requisitos da senha
            </Typography>
            <Typography variant="caption" display="block" color={senhaChecks.minLen ? 'success.main' : 'text.secondary'}>
              {senhaChecks.minLen ? 'OK' : 'Pendente'} Minimo de 6 caracteres
            </Typography>
            <Typography variant="caption" display="block" color={senhaChecks.hasLower ? 'success.main' : 'text.secondary'}>
              {senhaChecks.hasLower ? 'OK' : 'Pendente'} Letra minuscula
            </Typography>
            <Typography variant="caption" display="block" color={senhaChecks.hasUpper ? 'success.main' : 'text.secondary'}>
              {senhaChecks.hasUpper ? 'OK' : 'Pendente'} Letra maiuscula
            </Typography>
            <Typography variant="caption" display="block" color={senhaChecks.hasNumber ? 'success.main' : 'text.secondary'}>
              {senhaChecks.hasNumber ? 'OK' : 'Pendente'} Numero
            </Typography>
            <Typography variant="caption" display="block" color={senhaChecks.hasSymbol ? 'success.main' : 'text.secondary'}>
              {senhaChecks.hasSymbol ? 'OK' : 'Pendente'} Simbolo especial
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          {selectedCliente && (
            <Button color="error" onClick={() => handleDelete(selectedCliente)} disabled={loading}>
              Excluir
            </Button>
          )}
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
