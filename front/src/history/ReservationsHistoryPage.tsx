import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useApi } from "../hooks/useApi";

type ReservaItem = {
  id_reserva: number;
  data: string;
  horario_inicial: string;
  cancelado?: boolean | number;
  barbeiro_nome: string;
  cliente_nome: string;
  servico_nome: string;
};

// Funcao responsavel por normalizar datas para o formato YYYY-MM-DD quando o backend enviar data com timestamp.
function normalizeYmd(input: string) {
  if (!input) return "";
  if (input.includes("T")) return input.split("T")[0];
  return input;
}

// Funcao responsavel por combinar data e horario da reserva em um objeto Date para comparacoes temporais.
function getReservaDateTime(reserva: ReservaItem) {
  const dateKey = normalizeYmd(reserva.data);
  return new Date(`${dateKey}T${reserva.horario_inicial}`);
}

// Funcao responsavel por identificar reservas canceladas aceitando retorno booleano ou numerico da API.
function isReservaCanceled(reserva: ReservaItem) {
  return reserva.cancelado === true || Number(reserva.cancelado) === 1;
}

// Funcao responsavel por derivar o status visual da reserva com base em cancelamento e horario atual.
function getReservaStatus(reserva: ReservaItem) {
  if (isReservaCanceled(reserva)) {
    return { label: "Cancelado", color: "error" as const };
  }

  if (getReservaDateTime(reserva).getTime() < Date.now()) {
    return { label: "Realizado", color: "success" as const };
  }

  return { label: "Agendado", color: "info" as const };
}

// Funcao responsavel por carregar e exibir o historico completo de agendamentos com ordenacao e status.
export default function ReservationsHistoryPage() {
  const { request } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservas, setReservas] = useState<ReservaItem[]>([]);

  useEffect(() => {
    let mounted = true;

    // Funcao responsavel por buscar historico de reservas e atualizar estados de carregamento, erro e lista retornada.
    const loadHistory = async () => {
      setLoading(true);
      setError(null);

      const res = await request("/reservas?includeCanceled=true", { method: "GET" });

      if (!mounted) return;

      setLoading(false);

      if (!res.ok) {
        setReservas([]);
        setError(res.message || "Não foi possível carregar o histórico.");
        return;
      }

      const list = Array.isArray(res.data?.reservas) ? res.data.reservas : [];
      setReservas(list);
    };

    loadHistory();

    return () => {
      mounted = false;
    };
  }, [request]);

  const orderedReservas = useMemo(() => {
    return [...reservas].sort((a, b) => {
      const timeA = getReservaDateTime(a).getTime();
      const timeB = getReservaDateTime(b).getTime();
      return timeB - timeA;
    });
  }, [reservas]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Histórico de agendamentos
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Visão completa com status de todos os agendamentos.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && orderedReservas.length === 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Nenhum agendamento encontrado.
          </Typography>
        </Paper>
      )}

      {!loading && orderedReservas.length > 0 && (
        <Stack spacing={1.2}>
          {orderedReservas.map((reserva) => {
            const status = getReservaStatus(reserva);

            return (
              <Paper key={reserva.id_reserva} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {normalizeYmd(reserva.data)} às {reserva.horario_inicial.slice(0, 5)} - {reserva.servico_nome}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Cliente: {reserva.cliente_nome}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Barbeiro: {reserva.barbeiro_nome}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                    <Chip label={status.label} color={status.color} size="small" />
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
