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
  FormControlLabel,
  FormGroup,
  Checkbox,
  Typography,
  Snackbar,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTheme } from '@mui/material/styles';
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { formatPhoneBR, isAdultDate, isNotFutureDate, isStrongPassword, isValidEmail, normalizeUiError } from '../utils/formUtils';

interface BarbeiroData {
  id_barbeiro?: number;
  nome: string;
  email: string;
  telefone?: string;
  senha?: string;
  nascimento?: string;
  contratacao?: string;
  admin?: boolean;
  cor?: string;
  especialidadesIds?: number[];
}

interface EspecialidadeData {
  id_especialidade: number;
  nome: string;
}

interface BarbeiroEspecialidadeLink {
  id_barbeiro: number;
  id_especialidade: number;
}

// Funcao responsavel por administrar barbeiros, dados pessoais e vinculacao de especialidades no painel administrativo.
export default function BarbeirosCrud() {
  const { request } = useApi();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [barbeiros, setBarbeiros] = useState<BarbeiroData[]>([]);
  const [especialidades, setEspecialidades] = useState<EspecialidadeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<BarbeiroData | null>(null);
  const [editNascimentoInput, setEditNascimentoInput] = useState('');
  const [formData, setFormData] = useState<BarbeiroData>({
    nome: '',
    email: '',
    telefone: '',
    admin: false,
    cor: '#01325f',
    especialidadesIds: [],
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

  // Funcao responsavel por carregar barbeiros e seus vinculos de especialidade para exibicao na tabela.
  const loadBarbeiros = async () => {
    setLoading(true);
    setError(null);

    const [barbeirosRes, linksRes] = await Promise.all([
      request('/barbeiros', { method: 'GET' }),
      request('/barbeiro-especialidades', { method: 'GET' }),
    ]);

    if (!barbeirosRes.ok) {
      setBarbeiros([]);
      setError(barbeirosRes.message || 'Não foi possível carregar barbeiros');
      setLoading(false);
      return;
    }

    const baseBarbeiros = Array.isArray(barbeirosRes.data?.barbeiros)
      ? barbeirosRes.data.barbeiros
      : [];

    const links: BarbeiroEspecialidadeLink[] = Array.isArray(linksRes.data?.barbeiro_especialidades)
      ? linksRes.data.barbeiro_especialidades
      : [];

    const linksByBarber = links.reduce<Record<number, number[]>>((acc, item) => {
      const barberId = Number(item.id_barbeiro);
      const espId = Number(item.id_especialidade);
      if (!acc[barberId]) acc[barberId] = [];
      acc[barberId].push(espId);
      return acc;
    }, {});

    const merged = baseBarbeiros.map((barbeiro: BarbeiroData) => ({
      ...barbeiro,
      admin: Boolean(barbeiro.admin),
      especialidadesIds: linksByBarber[Number(barbeiro.id_barbeiro)] || [],
    }));

    setBarbeiros(merged);
    setLoading(false);
  };

  // Funcao responsavel por buscar especialidades disponiveis para compor o formulario de barbeiro.
  const loadEspecialidades = async () => {
    const res = await request('/especialidades', { method: 'GET' });

    if (res.ok && Array.isArray(res.data?.especialidades)) {
      setEspecialidades(res.data.especialidades);
      return;
    }

    setEspecialidades([]);
  };

  useEffect(() => {
    if (!isBarberAdmin) {
      setError('Apenas barbeiro admin pode gerenciar barbeiros');
      return;
    }

    loadEspecialidades();
    loadBarbeiros();
  }, [isBarberAdmin]);

  // Funcao responsavel por calcular idade com base na data de nascimento para validar regras de cadastro.
  const getAgeFromDate = (dateString?: string) => {
    if (!dateString) return null;
    const birth = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const beforeBirthday = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate());

    if (beforeBirthday) age -= 1;
    return age >= 0 ? age : null;
  };

  // Funcao responsavel por abrir o dialogo de barbeiro no modo criar ou editar, preparando os campos iniciais.
  const handleOpenDialog = (barbeiro?: BarbeiroData) => {
    if (barbeiro) {
      setSelectedBarbeiro(barbeiro);
      setEditNascimentoInput('');
      setFormData({
        ...barbeiro,
        admin: Boolean(barbeiro.admin),
        cor: barbeiro.cor || '#01325f',
        especialidadesIds: Array.isArray(barbeiro.especialidadesIds)
          ? barbeiro.especialidadesIds
          : [],
      });
    } else {
      setSelectedBarbeiro(null);
      setEditNascimentoInput('');
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        admin: false,
        cor: '#01325f',
        especialidadesIds: [],
      });
    }
    setOpenDialog(true);
  };

  // Funcao responsavel por fechar o dialogo e restaurar estado padrao do formulario.
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditNascimentoInput('');
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      admin: false,
      cor: '#01325f',
      especialidadesIds: [],
    });
  };

  // Funcao responsavel por criar os vinculos entre barbeiro e especialidades apos salvar os dados principais.
  const createBarberLinks = async (idBarbeiro: number, especialidadesIds: number[]) => {
    if (!especialidadesIds.length) {
      return { ok: true, message: '' };
    }

    const results = await Promise.all(
      especialidadesIds.map((idEspecialidade) =>
        request('/barbeiro-especialidades', {
          method: 'POST',
          body: JSON.stringify({
            id_barbeiro: idBarbeiro,
            id_especialidade: idEspecialidade,
          }),
        })
      )
    );

    const failed = results.filter((result) => !result.ok && result.message !== 'Vinculo ja existe.');
    if (failed.length) {
      return {
        ok: false,
        message: failed[0].message || 'Falha ao vincular especialidades.',
      };
    }

    return { ok: true, message: '' };
  };

  // Funcao responsavel por validar o formulario e persistir criacao/edicao de barbeiro na API.
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

    const birthDateForSave = selectedBarbeiro
      ? (editNascimentoInput || formData.nascimento || '')
      : (formData.nascimento || '');

    if (birthDateForSave && !isAdultDate(birthDateForSave)) {
      setError('Data de nascimento inválida. O barbeiro deve ter no mínimo 18 anos.');
      return;
    }

    if (formData.contratacao && !isNotFutureDate(formData.contratacao)) {
      setError('Data de contratação inválida. Não é permitido usar data futura.');
      return;
    }

    if (!selectedBarbeiro && !formData.senha) {
      setError('Senha é obrigatória para novo barbeiro.');
      return;
    }

    if (formData.senha && !isStrongPassword(formData.senha)) {
      setError('A senha deve conter ao menos 6 caracteres com maiúscula, minúscula, número e símbolo.');
      return;
    }

    setLoading(true);

    let idBarbeiro = selectedBarbeiro?.id_barbeiro;
    let res;

    const payloadBase = {
      nome: formData.nome,
      email: formData.email,
      telefone: formData.telefone || null,
      nascimento: birthDateForSave || null,
      contratacao: formData.contratacao || null,
      admin: Boolean(formData.admin),
      cor: formData.cor || '#01325f',
    };

    if (!selectedBarbeiro) {
      const createPayload = {
        ...payloadBase,
        senha: formData.senha || '',
      };

      res = await request('/barbeiros', {
        method: 'POST',
        body: JSON.stringify(createPayload),
      });

      if (res.ok) {
        idBarbeiro = res.data?.id_barbeiro;
      }
    } else {
      const updatePayload: Record<string, unknown> = { ...payloadBase };
      if (formData.senha) {
        updatePayload.senha = formData.senha;
      }

      res = await request(`/barbeiros/${selectedBarbeiro.id_barbeiro}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      });
    }

    if (!res.ok) {
      setLoading(false);
      setError(normalizeUiError(res.message || 'Erro ao processar requisição.'));
      return;
    }

    if (idBarbeiro) {
      const linkResult = await createBarberLinks(idBarbeiro, formData.especialidadesIds || []);
      if (!linkResult.ok) {
        setLoading(false);
        setError(normalizeUiError(linkResult.message || 'Erro ao vincular especialidades.'));
        return;
      }
    }

    setLoading(false);

    setSuccess(selectedBarbeiro ? 'Vínculos atualizados com sucesso!' : 'Barbeiro criado com sucesso!');
    handleCloseDialog();
    loadBarbeiros();
  };

  // Funcao responsavel por excluir barbeiro selecionado mediante confirmacao explicita do usuario.
  const handleDelete = async (barbeiro: BarbeiroData) => {
    if (!isBarberAdmin) {
      setError('Permissão negada');
      return;
    }

    if (!barbeiro.id_barbeiro) {
      return;
    }

    const confirmed = window.confirm(`Tem certeza que deseja excluir o barbeiro ${barbeiro.nome}?`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await request(`/barbeiros/${barbeiro.id_barbeiro}`, {
      method: 'DELETE',
    });

    setLoading(false);

    if (res.ok) {
      setSuccess('Barbeiro excluído com sucesso!');
      loadBarbeiros();
      return;
    }

    setError(normalizeUiError(res.message || 'Erro ao excluir barbeiro.'));
  };

  // Funcao responsavel por limpar mensagens de erro e sucesso exibidas em snackbars.
  const handleCloseFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  if (!isBarberAdmin) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">
          Apenas barbeiro admin pode gerenciar barbeiros
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <h2>Gerenciar Barbeiros</h2>
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
            Novo Barbeiro
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
            {barbeiros.map((barbeiro) => (
              <TableRow key={barbeiro.id_barbeiro}>
                <TableCell>
                  {isMobile ? (
                    <Button
                      variant="text"
                      color="inherit"
                      sx={{ textTransform: 'none', fontWeight: 700, p: 0, minWidth: 0 }}
                      onClick={() => handleOpenDialog(barbeiro)}
                    >
                      {barbeiro.nome}
                    </Button>
                  ) : (
                    <Box sx={{ fontWeight: 700 }}>{barbeiro.nome}</Box>
                  )}
                </TableCell>
                {!isMobile && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" variant="outlined" onClick={() => handleOpenDialog(barbeiro)}>
                      Editar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedBarbeiro ? 'Editar Barbeiro' : 'Novo Barbeiro'}
        </DialogTitle>
        <DialogContent
          sx={{
            pt: '32px !important',
            mt: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            columnGap: 2,
            rowGap: 2,
          }}
        >
          {error && (
            <Alert severity="error" onClose={handleCloseFeedback} sx={{ gridColumn: '1 / -1' }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={handleCloseFeedback} sx={{ gridColumn: '1 / -1' }}>
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
          {!selectedBarbeiro && (
            <TextField
              label="Data de Nascimento"
              type="date"
              value={formData.nascimento || ''}
              onChange={(e) => setFormData({ ...formData, nascimento: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
          {selectedBarbeiro && (
            <>
              <TextField
                label="Idade"
                value={getAgeFromDate(formData.nascimento) !== null ? `${getAgeFromDate(formData.nascimento)} anos` : 'Não informada'}
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="Alterar data de nascimento (opcional)"
                type="date"
                value={editNascimentoInput}
                onChange={(e) => setEditNascimentoInput(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
          <TextField
            label="Data de Contratação"
            type="date"
            value={formData.contratacao || ''}
            onChange={(e) => setFormData({ ...formData, contratacao: e.target.value })}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          {!selectedBarbeiro && (
            <TextField
              label="Senha"
              type="password"
              value={formData.senha || ''}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              fullWidth
            />
          )}
          {selectedBarbeiro && (
            <TextField
              label="Nova senha (opcional)"
              type="password"
              value={formData.senha || ''}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              fullWidth
            />
          )}
          <Box
            sx={{
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              gridColumn: '1 / -1',
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, gridColumn: '1 / -1' }}>
            <TextField
              label="Cor"
              type="color"
              value={formData.cor || '#01325f'}
              onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
              sx={{ width: 120 }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Código da cor"
              value={formData.cor || '#01325f'}
              onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
              placeholder="#01325f"
              fullWidth
            />
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(formData.admin)}
                onChange={(e) => setFormData({ ...formData, admin: e.target.checked })}
              />
            }
            sx={{ gridColumn: '1 / -1' }}
            label="É Admin?"
          />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Especialidades
            </Typography>
            <FormGroup row sx={{ columnGap: 2, rowGap: 1 }}>
              {especialidades.map((esp) => {
                const checked = (formData.especialidadesIds || []).includes(esp.id_especialidade);
                return (
                  <FormControlLabel
                    key={esp.id_especialidade}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={(e) => {
                          const current = formData.especialidadesIds || [];
                          const next = e.target.checked
                            ? [...current, esp.id_especialidade]
                            : current.filter((id) => id !== esp.id_especialidade);
                          setFormData({ ...formData, especialidadesIds: next });
                        }}
                      />
                    }
                    label={esp.nome}
                  />
                );
              })}
            </FormGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          {selectedBarbeiro && (
            <Button color="error" onClick={() => handleDelete(selectedBarbeiro)} disabled={loading}>
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
