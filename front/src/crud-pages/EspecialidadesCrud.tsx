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
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTheme } from '@mui/material/styles';
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { normalizeUiError } from '../utils/formUtils';

interface EspecialidadeData {
  id_especialidade?: number;
  nome: string;
  descricao?: string;
}

// Funcao responsavel por administrar especialidades de servico com operacoes de listar, criar, editar e excluir.
export default function EspecialidadesCrud() {
  const { request } = useApi();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [especialidades, setEspecialidades] = useState<EspecialidadeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEspecialidade, setSelectedEspecialidade] = useState<EspecialidadeData | null>(null);
  const [formData, setFormData] = useState<EspecialidadeData>({
    nome: '',
    descricao: '',
  });

  const isBarberAdmin = user?.role === 'barbeiro' && user?.admin === true;

  // Funcao responsavel por carregar a lista de especialidades no backend e sincronizar com o estado da tabela.
  const loadEspecialidades = async () => {
    setLoading(true);
    setError(null);

    const res = await request('/especialidades', { method: 'GET' });

    if (res.ok && Array.isArray(res.data?.especialidades)) {
      setEspecialidades(res.data.especialidades);
    } else {
      setEspecialidades([]);
      setError(res.message || 'Não foi possível carregar especialidades');
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isBarberAdmin) {
      setError('Apenas barbeiro admin pode gerenciar especialidades');
      return;
    }

    loadEspecialidades();
  }, [isBarberAdmin]);

  // Funcao responsavel por abrir o dialogo de cadastro/edicao preenchendo o formulario quando houver item selecionado.
  const handleOpenDialog = (especialidade?: EspecialidadeData) => {
    if (especialidade) {
      setSelectedEspecialidade(especialidade);
      setFormData(especialidade);
    } else {
      setSelectedEspecialidade(null);
      setFormData({ nome: '', descricao: '' });
    }
    setOpenDialog(true);
  };

  // Funcao responsavel por fechar o dialogo e resetar os estados temporarios do formulario.
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({ nome: '', descricao: '' });
  };

  // Funcao responsavel por persistir alteracoes de especialidade e atualizar a grade apos sucesso.
  const handleSave = async () => {
    if (!isBarberAdmin) {
      setError('Permissão negada');
      return;
    }

    setError(null);
    setSuccess(null);

    if (!formData.nome) {
      setError('Nome é obrigatório');
      return;
    }

    const nomeNormalizado = formData.nome.trim().toLowerCase();
    const duplicada = especialidades.some((esp) => {
      if (selectedEspecialidade?.id_especialidade && esp.id_especialidade === selectedEspecialidade.id_especialidade) {
        return false;
      }
      return esp.nome.trim().toLowerCase() === nomeNormalizado;
    });

    if (duplicada) {
      setError('Já existe uma especialidade com esse nome');
      return;
    }

    setLoading(true);
    const res = await request('/especialidades', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    setLoading(false);

    if (res.ok) {
      setSuccess('Especialidade criada com sucesso!');
      handleCloseDialog();
      loadEspecialidades();
    } else {
      setError(normalizeUiError(res.message || 'Erro ao processar requisição.'));
    }
  };

  // Funcao responsavel por excluir uma especialidade com confirmacao previa do usuario.
  const handleDelete = async (especialidade: EspecialidadeData) => {
    if (!isBarberAdmin) {
      setError('Permissão negada');
      return;
    }

    if (!especialidade.id_especialidade) {
      return;
    }

    const confirmed = window.confirm(`Tem certeza que deseja excluir a especialidade ${especialidade.nome}?`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await request(`/especialidades/${especialidade.id_especialidade}`, {
      method: 'DELETE',
    });

    setLoading(false);

    if (res.ok) {
      setSuccess('Especialidade excluída com sucesso!');
      loadEspecialidades();
      return;
    }

    setError(normalizeUiError(res.message || 'Erro ao excluir especialidade.'));
  };

  // Funcao responsavel por fechar alertas de erro e sucesso mostrados ao usuario.
  const handleCloseFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  if (!isBarberAdmin) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">
          Apenas barbeiro admin pode gerenciar especialidades
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <h2>Gerenciar Especialidades</h2>
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
            Nova Especialidade
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
            {especialidades.map((esp) => (
              <TableRow key={esp.id_especialidade}>
                <TableCell>
                  {isMobile ? (
                    <Button
                      variant="text"
                      color="inherit"
                      sx={{ textTransform: 'none', fontWeight: 700, p: 0, minWidth: 0 }}
                      onClick={() => handleOpenDialog(esp)}
                    >
                      {esp.nome}
                    </Button>
                  ) : (
                    <Box sx={{ fontWeight: 700 }}>{esp.nome}</Box>
                  )}
                </TableCell>
                {!isMobile && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" variant="outlined" onClick={() => handleOpenDialog(esp)}>
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
          {selectedEspecialidade ? 'Editar Especialidade' : 'Nova Especialidade'}
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
            label="Descrição"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            fullWidth
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          {selectedEspecialidade && (
            <Button color="error" onClick={() => handleDelete(selectedEspecialidade)} disabled={loading}>
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
