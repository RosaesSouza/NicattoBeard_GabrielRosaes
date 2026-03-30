import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../hooks/useApi";

type BarbeiroOption = {
  id_barbeiro: number;
  nome: string;
};

type ServicoOption = {
  id_servico: number;
  nome: string;
  valor: number;
  tempo_medio: number;
  id_especialidade: number;
};

type BarbeiroEspecialidadeLink = {
  id_barbeiro: number;
  id_especialidade: number;
};

type ReservaDisponibilidade = {
  id_reserva: number;
  horario_inicial: string;
  tempo_medio: number;
};

type SchedulePageProps = {
  onBackHome: () => void;
  onScheduleResult?: (notice: { severity: "success" | "error"; message: string }) => void;
};

// Funcao responsavel por conduzir o fluxo de novo agendamento do cliente, desde a selecao de servico ate a confirmacao.
export default function SchedulePage({ onBackHome, onScheduleResult }: SchedulePageProps) {
  const { user } = useAuth();
  const { request } = useApi();

  const [loading, setLoading] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [barbeiros, setBarbeiros] = useState<BarbeiroOption[]>([]);
  const [servicos, setServicos] = useState<ServicoOption[]>([]);
  const [barbeiroEspecialidades, setBarbeiroEspecialidades] = useState<BarbeiroEspecialidadeLink[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createData, setCreateData] = useState({
    id_barbeiro: 0,
    id_servico: 0,
    data: "",
    horario_inicial: "",
  });

  useEffect(() => {
    let mounted = true;

    // Funcao responsavel por carregar barbeiros, servicos e especialidades necessarios para montar as opcoes de agenda.
    const loadScheduleOptions = async () => {
      setLoading(true);
      setError(null);

      const [barbeirosRes, servicosRes, linksRes] = await Promise.all([
        request("/barbeiros", { method: "GET" }),
        request("/servicos", { method: "GET" }),
        request("/barbeiro-especialidades", { method: "GET" }),
      ]);

      if (!mounted) return;

      setLoading(false);

      if (!barbeirosRes.ok || !servicosRes.ok || !linksRes.ok) {
        setError(
          barbeirosRes.message || servicosRes.message || linksRes.message || "Não foi possível carregar opções de agendamento."
        );
        return;
      }

      setBarbeiros(Array.isArray(barbeirosRes.data?.barbeiros) ? barbeirosRes.data.barbeiros : []);
      setServicos(
        Array.isArray(servicosRes.data?.servicos)
          ? servicosRes.data.servicos.map((item: any) => ({
              ...item,
              valor: Number(item.valor ?? 0),
              tempo_medio: Number(item.tempo_medio ?? 1),
              id_especialidade: Number(item.id_especialidade ?? 0),
            }))
          : []
      );
      setBarbeiroEspecialidades(
        Array.isArray(linksRes.data?.barbeiro_especialidades) ? linksRes.data.barbeiro_especialidades : []
      );
    };

    loadScheduleOptions();

    return () => {
      mounted = false;
    };
  }, [request]);

  const selectedServico = useMemo(
    () => servicos.find((servico) => servico.id_servico === createData.id_servico) || null,
    [servicos, createData.id_servico]
  );

  const eligibleBarbers = useMemo(() => {
    if (!selectedServico) return [];

    const eligibleIds = new Set(
      barbeiroEspecialidades
        .filter((link) => Number(link.id_especialidade) === Number(selectedServico.id_especialidade))
        .map((link) => Number(link.id_barbeiro))
    );

    return barbeiros.filter((barbeiro) => eligibleIds.has(Number(barbeiro.id_barbeiro)));
  }, [selectedServico, barbeiroEspecialidades, barbeiros]);

  useEffect(() => {
    setCreateData((prev) => ({ ...prev, id_barbeiro: 0, data: "", horario_inicial: "" }));
    setAvailableTimes([]);
  }, [createData.id_servico]);

  useEffect(() => {
    setCreateData((prev) => ({ ...prev, horario_inicial: "" }));
    setAvailableTimes([]);
  }, [createData.id_barbeiro, createData.data]);

  useEffect(() => {
    // Funcao responsavel por calcular horarios livres considerando ocupacao do barbeiro e duracao do servico escolhido.
    const loadAvailableTimes = async () => {
      if (!createData.id_barbeiro || !createData.data || !selectedServico) {
        setAvailableTimes([]);
        return;
      }

      setLoadingTimes(true);
      const res = await request(
        `/horarios-disponiveis?id_barbeiro=${createData.id_barbeiro}&data=${createData.data}`,
        { method: "GET" }
      );
      setLoadingTimes(false);

      if (!res.ok) {
        setAvailableTimes([]);
        setError(res.message || "Não foi possível carregar horários disponíveis.");
        return;
      }

      const reservas: ReservaDisponibilidade[] = Array.isArray(res.data?.reservas) ? res.data.reservas : [];
      const occupiedSlots = new Set<number>();

      for (const reserva of reservas) {
        const [hRaw, mRaw] = String(reserva.horario_inicial || "").slice(0, 5).split(":");
        const h = Number(hRaw);
        const m = Number(mRaw);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;

        const startSlot = (h - 8) * 2 + (m >= 30 ? 1 : 0);
        const size = Math.min(4, Math.max(1, Number(reserva.tempo_medio) || 1));

        for (let slot = startSlot; slot < startSlot + size; slot += 1) {
          if (slot >= 0 && slot < 20) occupiedSlots.add(slot);
        }
      }

      const desiredSize = Math.min(4, Math.max(1, Number(selectedServico.tempo_medio) || 1));
      const times: string[] = [];
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const isToday = createData.data === todayKey;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      for (let startSlot = 0; startSlot <= 20 - desiredSize; startSlot += 1) {
        let canUse = true;
        for (let check = startSlot; check < startSlot + desiredSize; check += 1) {
          if (occupiedSlots.has(check)) {
            canUse = false;
            break;
          }
        }

        if (canUse) {
          const totalMinutes = 8 * 60 + startSlot * 30;
          if (isToday && totalMinutes <= nowMinutes) {
            continue;
          }
          const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
          const mm = String(totalMinutes % 60).padStart(2, "0");
          times.push(`${hh}:${mm}`);
        }
      }

      setAvailableTimes(times);
    };

    loadAvailableTimes();
  }, [createData.id_barbeiro, createData.data, selectedServico, request]);

  const selectedBarbeiro = useMemo(
    () => eligibleBarbers.find((barbeiro) => barbeiro.id_barbeiro === createData.id_barbeiro) || null,
    [eligibleBarbers, createData.id_barbeiro]
  );

  const canOpenConfirm = Boolean(
    createData.id_servico && createData.id_barbeiro && createData.data && createData.horario_inicial
  );

  // Funcao responsavel por validar campos obrigatorios antes de abrir o dialogo final de confirmacao.
  const handleOpenConfirm = () => {
    setError(null);
    setSuccess(null);

    if (!canOpenConfirm) {
      setError("Selecione serviço, barbeiro, data e horário.");
      return;
    }

    setOpenConfirm(true);
  };

  // Funcao responsavel por enviar a reserva para a API e atualizar feedback de sucesso/erro no dashboard do cliente.
  const handleCreateReserva = async () => {
    setError(null);
    setSuccess(null);

    setLoading(true);
    const res = await request("/reservas", {
      method: "POST",
      body: JSON.stringify({
        id_barbeiro: createData.id_barbeiro,
        id_cliente: user?.id,
        id_servico: createData.id_servico,
        data: createData.data,
        horario_inicial: `${createData.horario_inicial}:00`,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const isConflict = String(res.message || "").toLowerCase().includes("já possui reserva nesse horário");
      const message = isConflict
        ? "Não foi possível fazer o registro: esse horário acabou de ser reservado por outra pessoa."
        : res.message || "Não foi possível fazer o registro.";
      setError(message);
      onScheduleResult?.({ severity: "error", message });
      return;
    }

    setOpenConfirm(false);
    const message = "Agendamento registrado com sucesso.";
    setSuccess(message);
    setCreateData({ id_barbeiro: 0, id_servico: 0, data: "", horario_inicial: "" });
    setAvailableTimes([]);
    onScheduleResult?.({ severity: "success", message });
    onBackHome();
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }} className="fade-in-page">
        <Typography variant="h4" component="h1" sx={{ mb: 0.5 }}>
          Agendar Serviço
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Escolha o serviço, barbeiro compatível, dia e horário. Ao final confirme os dados da reserva.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="schedule-servico-label">Serviço</InputLabel>
            <Select
              labelId="schedule-servico-label"
              label="Serviço"
              value={createData.id_servico}
              onChange={(e) => setCreateData((prev) => ({ ...prev, id_servico: Number(e.target.value) }))}
            >
              <MenuItem value={0}>Selecione um serviço</MenuItem>
              {servicos.map((servico) => (
                <MenuItem key={servico.id_servico} value={servico.id_servico}>
                  {servico.nome} - R$ {Number(servico.valor).toFixed(2)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={!selectedServico}>
            <InputLabel id="schedule-barbeiro-label">Barbeiro</InputLabel>
            <Select
              labelId="schedule-barbeiro-label"
              label="Barbeiro"
              value={createData.id_barbeiro}
              onChange={(e) => setCreateData((prev) => ({ ...prev, id_barbeiro: Number(e.target.value) }))}
            >
              <MenuItem value={0}>
                {selectedServico ? "Selecione um barbeiro" : "Escolha um serviço primeiro"}
              </MenuItem>
              {eligibleBarbers.map((barbeiro) => (
                <MenuItem key={barbeiro.id_barbeiro} value={barbeiro.id_barbeiro}>
                  {barbeiro.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Data"
            type="date"
            value={createData.data}
            onChange={(e) => setCreateData((prev) => ({ ...prev, data: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().slice(0, 10) }}
            disabled={!createData.id_barbeiro}
            fullWidth
          />

          <FormControl fullWidth disabled={!createData.data || !createData.id_barbeiro || loadingTimes}>
            <InputLabel id="schedule-time-label">Horário</InputLabel>
            <Select
              labelId="schedule-time-label"
              label="Horário"
              value={createData.horario_inicial}
              onChange={(e) => setCreateData((prev) => ({ ...prev, horario_inicial: String(e.target.value) }))}
            >
              <MenuItem value="">
                {loadingTimes ? "Carregando horários..." : "Selecione um horário"}
              </MenuItem>
              {availableTimes.map((time) => (
                <MenuItem key={time} value={time}>
                  {time}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {createData.data && !loadingTimes && availableTimes.length === 0 && (
            <Alert severity="info">Não há horários livres para esse barbeiro nessa data.</Alert>
          )}
        </Stack>

        <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
          <Button variant="text" onClick={onBackHome}>
            Voltar para início
          </Button>
          <Button variant="contained" onClick={handleOpenConfirm} disabled={loading || loadingTimes || !canOpenConfirm}>
            Revisar agendamento
          </Button>
        </Box>
      </Paper>

      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar agendamento</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Typography variant="body2"><strong>Data:</strong> {createData.data}</Typography>
            <Typography variant="body2"><strong>Horário:</strong> {createData.horario_inicial}</Typography>
            <Divider />
            <Typography variant="body2"><strong>Serviço:</strong> {selectedServico?.nome}</Typography>
            <Typography variant="body2"><strong>Barbeiro:</strong> {selectedBarbeiro?.nome}</Typography>
            <Typography variant="body2"><strong>Valor:</strong> R$ {Number(selectedServico?.valor || 0).toFixed(2)}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)}>Voltar</Button>
          <Button variant="contained" color="secondary" onClick={handleCreateReserva} disabled={loading}>
            {loading ? "Agendando..." : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
