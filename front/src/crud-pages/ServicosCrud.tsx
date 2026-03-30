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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  Snackbar,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTheme } from '@mui/material/styles';
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { currencyBRToNumber, maskCurrencyBR, normalizeUiError, numberToCurrencyBR } from '../utils/formUtils';

interface ServicoData {
  id_servico?: number;
  nome: string;
  descricao?: string;
  valor: number;
  tempo_medio?: number;
  id_especialidade: number;
}

interface Especialidade {
  id_especialidade: number;
  nome: string;
}

type ServicoApiItem = {
  id_servico?: number;
  nome?: string;
  descricao?: string | null;
  valor?: number | string | null;
  tempo_medio?: number | string | null;
  id_especialidade?: number | string | null;
};

const TIME_BLOCK_OPTIONS = [
  { value: 1, label: '30 minutos' },
  { value: 2, label: '60 minutos' },
  { value: 3, label: '90 minutos' },
  { value: 4, label: '120 minutos' },
];

// Funcao responsavel por normalizar o tempo medio para blocos de 30 minutos, preservando compatibilidade com dados antigos.
function toTempoBlocos(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 1);
  if (!Number.isFinite(numeric)) return 1;
  if (numeric <= 4) return Math.min(4, Math.max(1, Math.trunc(numeric)));

  return Math.min(4, Math.max(1, Math.ceil(numeric / 30)));
}

// Funcao responsavel por gerenciar o CRUD de servicos, incluindo valor, duracao e especialidade vinculada.
export default function ServicosCrud() {
  const { request } = useApi();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [servicos, setServicos] = useState<ServicoData[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedServico, setSelectedServico] = useState<ServicoData | null>(null);
  const [valorInput, setValorInput] = useState('0,00');
  const [formData, setFormData] = useState<ServicoData>({
    nome: '',
    descricao: '',
    valor: 0,
    tempo_medio: 1,
    id_especialidade: 0,
  });

  const isBarberAdmin = user?.role === 'barbeiro' && user?.admin === true;

  const normalizeServico = (item: ServicoApiItem): ServicoData => ({
    id_servico: item.id_servico,
    nome: item.nome || '',
    descricao: item.descricao || '',
    valor: Number(item.valor ?? 0),
    tempo_medio: toTempoBlocos(item.tempo_medio),
    id_especialidade: Number(item.id_especialidade ?? 0),
  });

  // Funcao responsavel por carregar servicos e especialidades da API para alimentar tabela e formulario.
  const loadServicos = async () => {
    setLoading(true);
    setError(null);

    const [servicosRes, especialidadesRes] = await Promise.all([
      request('/servicos', { method: 'GET' }),
      request('/especialidades', { method: 'GET' }),
    ]);

    if (servicosRes.ok && Array.isArray(servicosRes.data?.servicos)) {
      const normalized = (servicosRes.data.servicos as ServicoApiItem[]).map(normalizeServico);
      setServicos(normalized);
    } else {
      setServicos([]);
      setError(servicosRes.message || 'Não foi possível carregar serviços');
    }

    if (especialidadesRes.ok && Array.isArray(especialidadesRes.data?.especialidades)) {
      setEspecialidades(especialidadesRes.data.especialidades);
    } else {
      setEspecialidades([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isBarberAdmin) {
      setError('Apenas barbeiro admin pode gerenciar serviços');
      return;
    }

    loadServicos();
  }, [isBarberAdmin]);

  // Funcao responsavel por abrir o dialogo de servico com dados iniciais de criacao ou edicao.
  const handleOpenDialog = (servico?: ServicoData) => {
    if (servico) {
      setSelectedServico(servico);
      setFormData({
        ...servico,
        tempo_medio: toTempoBlocos(servico.tempo_medio),
      });
      setValorInput(numberToCurrencyBR(servico.valor));
    } else {
      setSelectedServico(null);
      setFormData({
        nome: '',
        descricao: '',
        valor: 0,
        tempo_medio: 1,
        id_especialidade: 0,
      });
      setValorInput('0,00');
    }
    setOpenDialog(true);
  };

  // Funcao responsavel por fechar o dialogo e limpar estados transitios do formulario de servico.
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      nome: '',
      descricao: '',
      valor: 0,
      tempo_medio: 1,
      id_especialidade: 0,
    });
    setValorInput('0,00');
  };

  // Funcao responsavel por validar e salvar servico no backend, atualizando a listagem em seguida.
  const handleSave = async () => {
    if (!isBarberAdmin) {
      setError('Permissão negada');
      return;
    }

    setError(null);
    setSuccess(null);

    if (!formData.nome || !formData.valor || !formData.id_especialidade || !formData.tempo_medio) {
      setError('Nome, valor, tempo médio e especialidade são obrigatórios.');
      return;
    }

    setLoading(true);
    const endpoint = selectedServico?.id_servico ? `/servicos/${selectedServico.id_servico}` : '/servicos';
    const method = selectedServico?.id_servico ? 'PUT' : 'POST';

    const res = await request(endpoint, {
      method,
      body: JSON.stringify(formData),
    });

    setLoading(false);

    if (res.ok) {
      setSuccess(selectedServico ? 'Serviço atualizado com sucesso!' : 'Serviço criado com sucesso!');
      handleCloseDialog();
      loadServicos();
    } else {
      setError(normalizeUiError(res.message || 'Erro ao processar requisição.'));
    }
  };

  // Funcao responsavel por remover servico selecionado apos confirmacao do usuario.
  const handleDelete = async (servico: ServicoData) => {
    if (!isBarberAdmin) {
      setError('Permissão negada');
      return;
    }

    if (!servico.id_servico) {
      return;
    }

    const confirmed = window.confirm(`Tem certeza que deseja excluir o serviço ${servico.nome}?`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await request(`/servicos/${servico.id_servico}`, {
      method: 'DELETE',
    });

    setLoading(false);

    if (res.ok) {
      setSuccess('Serviço excluído com sucesso!');
      loadServicos();
      return;
    }

    setError(normalizeUiError(res.message || 'Erro ao excluir serviço.'));
  };

  // Funcao responsavel por aplicar mascara monetaria no campo de valor enquanto o usuario digita.
  const handleValorChange = (value: string) => {
    const masked = maskCurrencyBR(value);
    setValorInput(masked);
    setFormData({
      ...formData,
      valor: currencyBRToNumber(masked),
    });
  };

  // Funcao responsavel por encerrar mensagens de retorno exibidas na interface.
  const handleCloseFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  if (!isBarberAdmin) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">
          Apenas barbeiro admin pode gerenciar serviços
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <h2>Gerenciar Serviços</h2>
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
            Novo Serviço
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
            <TableRow sx={{ bgcolor: '#e96c4f', '& .MuiTableCell-head': { color: '#ffffff' } }}>
              <TableCell>Nome</TableCell>
              {!isMobile && <TableCell align="right">Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {servicos.map((servico) => (
              <TableRow key={servico.id_servico}>
                <TableCell>
                  {isMobile ? (
                    <Button
                      variant="text"
                      color="inherit"
                      sx={{ textTransform: 'none', fontWeight: 700, p: 0, minWidth: 0 }}
                      onClick={() => handleOpenDialog(servico)}
                    >
                      {servico.nome}
                    </Button>
                  ) : (
                    <Box sx={{ fontWeight: 700 }}>{servico.nome}</Box>
                  )}
                </TableCell>
                {!isMobile && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" variant="outlined" onClick={() => handleOpenDialog(servico)}>
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
          {selectedServico ? 'Editar Serviço' : 'Novo Serviço'}
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
          <TextField
            label="Valor"
            type="text"
            value={valorInput}
            onChange={(e) => handleValorChange(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Tempo Médio</InputLabel>
            <Select
              label="Tempo Médio"
              value={formData.tempo_medio || 1}
              onChange={(e) => setFormData({ ...formData, tempo_medio: Number(e.target.value) })}
            >
              {TIME_BLOCK_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Especialidade</InputLabel>
            <Select
              label="Especialidade"
              value={formData.id_especialidade}
              onChange={(e) => setFormData({ ...formData, id_especialidade: e.target.value as number })}
            >
              <MenuItem value={0}>Selecione uma especialidade</MenuItem>
              {especialidades.map((esp) => (
                <MenuItem key={esp.id_especialidade} value={esp.id_especialidade}>
                  {esp.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          {selectedServico && (
            <Button color="error" onClick={() => handleDelete(selectedServico)} disabled={loading}>
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
