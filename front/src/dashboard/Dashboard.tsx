import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../hooks/useApi";

type ReservaItem = {
  id_reserva: number;
  id_barbeiro: number;
  id_cliente: number;
  id_servico: number;
  data: string;
  horario_inicial: string;
  cancelado?: boolean | number;
  barbeiro_nome: string;
  barbeiro_cor?: string;
  cliente_nome: string;
  servico_nome: string;
  tempo_medio?: number;
};

type BarbeiroOption = {
  id_barbeiro: number;
  nome: string;
  cor?: string;
};

type ServicoOption = {
  id_servico: number;
  id_especialidade: number;
};

type BarbeiroEspecialidadeLink = {
  id_barbeiro: number;
  id_especialidade: number;
};

// Funcao responsavel por converter objeto Date para string YYYY-MM-DD usada nos filtros e comparacoes do dashboard.
function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Funcao responsavel por normalizar datas vindas da API para manter comparacoes consistentes no front.
function normalizeYmd(input: string) {
  if (!input) return "";
  if (input.includes("T")) return input.split("T")[0];
  return input;
}

// Funcao responsavel por zerar horario de uma data e trabalhar comparacoes apenas por dia.
function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Funcao responsavel por gerar nova data deslocada em quantidade de dias para navegacao semanal.
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Funcao responsavel por interpretar data no formato YYYY-MM-DD como data local do navegador.
function parseYmdLocal(input: string) {
  const normalized = normalizeYmd(input);
  const [yearRaw, monthRaw, dayRaw] = normalized.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const weekdayLongFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

const SLOT_START_HOUR = 8;
const SLOT_MINUTES = 30;
const SLOT_COUNT = 20;
const SLOT_PX = 28;
const CLIENT_CANCEL_LIMIT_HOURS = 2;
const BARBER_AUTO_REFRESH_MS = 15000;

// Funcao responsavel por converter horario textual em indice de slot de agenda com blocos de 30 minutos.
function toSlotIndex(time: string): number {
  const [hourRaw, minuteRaw] = time.slice(0, 5).split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return -1;

  const totalMinutes = hour * 60 + minute;
  const firstMinute = SLOT_START_HOUR * 60;
  return Math.floor((totalMinutes - firstMinute) / SLOT_MINUTES);
}

// Funcao responsavel por gerar rótulo HH:MM de cada slot exibido no calendario.
function getSlotLabel(slotIdx: number): string {
  const totalMinutes = SLOT_START_HOUR * 60 + slotIdx * SLOT_MINUTES;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Funcao responsavel por escolher cor de texto com contraste adequado para a cor de fundo de cada barbeiro.
function getTextColorByHex(hex?: string) {
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(hex || "") ? (hex as string) : "#01325f";
  const r = parseInt(safeHex.slice(1, 3), 16);
  const g = parseInt(safeHex.slice(3, 5), 16);
  const b = parseInt(safeHex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#000000" : "#ffffff";
}

// Funcao responsavel por identificar se uma reserva esta cancelada aceitando formatos booleanos e numericos.
function isReservaCanceled(reserva: ReservaItem) {
  return reserva.cancelado === true || Number(reserva.cancelado) === 1;
}

type DashboardProps = {
  onOpenSchedulePage?: () => void;
  clientNotice?: { severity: "success" | "error"; message: string } | null;
  onConsumeClientNotice?: () => void;
};

// Funcao responsavel por montar o painel principal, carregar reservas e controlar interacoes de agenda por perfil.
export default function Dashboard({ onOpenSchedulePage, clientNotice, onConsumeClientNotice }: DashboardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user } = useAuth();
  const { request } = useApi();
  const isCliente = user?.role === "cliente";
  const isBarberNonAdmin = user?.role === "barbeiro" && user?.admin !== true;

  const [weekStart, setWeekStart] = useState<Date>(startOfDay(new Date()));
  const [reservas, setReservas] = useState<ReservaItem[]>([]);
  const [statsReservas, setStatsReservas] = useState<ReservaItem[]>([]);
  const [barbeiros, setBarbeiros] = useState<BarbeiroOption[]>([]);
  const [servicos, setServicos] = useState<ServicoOption[]>([]);
  const [barbeiroEspecialidades, setBarbeiroEspecialidades] = useState<BarbeiroEspecialidadeLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [calendarBarbeiroId, setCalendarBarbeiroId] = useState<number | "all">("all");

  const [openEdit, setOpenEdit] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState<ReservaItem | null>(null);
  const [editData, setEditData] = useState({ id_barbeiro: 0, horario_inicial: "" });
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [historyTab, setHistoryTab] = useState<"realizados" | "cancelados">("realizados");

  useEffect(() => {
    if (!isCliente || !clientNotice?.message) return;

    if (clientNotice.severity === "success") {
      setSuccess(clientNotice.message);
      setError(null);
    } else {
      setError(clientNotice.message);
      setSuccess(null);
    }

    onConsumeClientNotice?.();
  }, [isCliente, clientNotice, onConsumeClientNotice]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // Funcao responsavel por montar o instante de inicio da reserva para validacoes de horario e cancelamento.
  const getReservaStartTime = (reserva: ReservaItem) => {
    const dateKey = normalizeYmd(reserva.data);
    return new Date(`${dateKey}T${reserva.horario_inicial}`);
  };

  // Funcao responsavel por indicar se a reserva ja iniciou para bloquear alteracoes indevidas.
  const hasReservaStarted = (reserva: ReservaItem) => {
    return getReservaStartTime(reserva).getTime() <= Date.now();
  };

  // Funcao responsavel por verificar se o cliente ainda pode cancelar respeitando a antecedencia minima.
  const canClienteCancelReserva = (reserva: ReservaItem) => {
    const diffMs = getReservaStartTime(reserva).getTime() - Date.now();
    return diffMs >= CLIENT_CANCEL_LIMIT_HOURS * 60 * 60 * 1000;
  };

  // Funcao responsavel por formatar o rótulo de data dos agendamentos ativos em Hoje, dia da semana ou dd/mm.
  const getActiveReservaDateLabel = (reserva: ReservaItem) => {
    const reservaDate = parseYmdLocal(reserva.data);
    if (!reservaDate) return normalizeYmd(reserva.data);

    const now = new Date();
    const today = startOfDay(now);
    const reservaDay = startOfDay(reservaDate);

    if (reservaDay.getTime() === today.getTime()) {
      return "Hoje";
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((reservaDay.getTime() - today.getTime()) / msPerDay);

    if (reservaDay > today && diffDays <= 7) {
      const weekday = weekdayLongFormatter.format(reservaDay);
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }

    return dateFormatter.format(reservaDay);
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const date = addDays(weekStart, idx);
      const key = toYmd(date);
      return {
        date,
        key,
        label: `${weekdayFormatter.format(date)} ${dateFormatter.format(date)}`,
      };
    });
  }, [weekStart]);

  const visibleCalendarDays = useMemo(() => {
    return isMobile ? weekDays.slice(0, 1) : weekDays;
  }, [isMobile, weekDays]);

  const calendarBarberOptions = useMemo(() => {
    if (barbeiros.length) {
      return [...barbeiros]
        .map((barbeiro) => ({ id: Number(barbeiro.id_barbeiro), nome: barbeiro.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }

    const map = new Map<number, string>();
    for (const reserva of reservas) {
      const barberId = Number(reserva.id_barbeiro);
      if (!Number.isFinite(barberId)) continue;
      if (!map.has(barberId)) {
        map.set(barberId, reserva.barbeiro_nome || `Barbeiro ${barberId}`);
      }
    }

    return [...map.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [barbeiros, reservas]);

  useEffect(() => {
    if (calendarBarbeiroId === "all") return;

    const stillExists = calendarBarberOptions.some((option) => option.id === calendarBarbeiroId);
    if (!stillExists) {
      setCalendarBarbeiroId("all");
    }
  }, [calendarBarbeiroId, calendarBarberOptions]);

  const calendarReservas = useMemo(() => {
    if (isCliente) return reservas;
    if (calendarBarbeiroId === "all") return reservas;
    return reservas.filter((reserva) => Number(reserva.id_barbeiro) === Number(calendarBarbeiroId));
  }, [reservas, isCliente, calendarBarbeiroId]);

  const reservasByDay = useMemo(() => {
    const grouped: Record<string, ReservaItem[]> = {};
    for (const day of visibleCalendarDays) {
      grouped[day.key] = [];
    }

    for (const reserva of calendarReservas) {
      const reservaDateKey = normalizeYmd(reserva.data);
      if (grouped[reservaDateKey]) {
        grouped[reservaDateKey].push(reserva);
      }
    }

    for (const day of visibleCalendarDays) {
      grouped[day.key].sort((a, b) => a.horario_inicial.localeCompare(b.horario_inicial));
    }

    return grouped;
  }, [calendarReservas, visibleCalendarDays]);

  const calendarSlots = useMemo(
    () => Array.from({ length: SLOT_COUNT }, (_, idx) => ({ idx, label: getSlotLabel(idx) })),
    []
  );

  const nowIndicator = useMemo(() => {
    const now = new Date(clockTick);
    const todayKey = toYmd(startOfDay(now));
    const isCurrentWeekVisible = visibleCalendarDays.some((day) => day.key === todayKey);

    if (!isCurrentWeekVisible) return null;

    const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const dayStartMinutes = SLOT_START_HOUR * 60;
    const dayDurationMinutes = SLOT_COUNT * SLOT_MINUTES;
    const elapsed = minutesNow - dayStartMinutes;

    if (elapsed < 0 || elapsed > dayDurationMinutes) return null;

    return {
      todayKey,
      topPx: (elapsed / SLOT_MINUTES) * SLOT_PX,
      label: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    };
  }, [clockTick, visibleCalendarDays]);

  const barberColorById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const barber of barbeiros) {
      if (barber?.id_barbeiro) {
        map[Number(barber.id_barbeiro)] = barber.cor || "#01325f";
      }
    }
    return map;
  }, [barbeiros]);

  const dayLaneMap = useMemo(() => {
    const map: Record<number, { laneIndex: number; laneCount: number }> = {};

    const timeToMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.slice(0, 5).split(":").map(Number);
      return hours * 60 + minutes;
    };

    for (const day of visibleCalendarDays) {
      const items = reservasByDay[day.key] || [];

      const itemsWithDuration = items.map((item) => ({
        ...item,
        startMin: timeToMinutes(item.horario_inicial),
        endMin: timeToMinutes(item.horario_inicial) + (Number(item.tempo_medio) || 1) * 30,
      }));

      const lanes: Array<Array<typeof itemsWithDuration[0]>> = [];

      for (const item of itemsWithDuration) {
        let assignedLane = -1;

        for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
          const lane = lanes[laneIdx];
          const hasCollision = lane.some(
            (existing) =>
              !(item.endMin <= existing.startMin || item.startMin >= existing.endMin)
          );

          if (!hasCollision) {
            assignedLane = laneIdx;
            break;
          }
        }

        if (assignedLane === -1) {
          lanes.push([]);
          assignedLane = lanes.length - 1;
        }

        lanes[assignedLane].push(item);
        map[item.id_reserva] = {
          laneIndex: assignedLane,
          laneCount: 0,
        };
      }

      for (const item of itemsWithDuration) {
        if (map[item.id_reserva]) {
          map[item.id_reserva].laneCount = lanes.length;
        }
      }
    }

    return map;
  }, [visibleCalendarDays, reservasByDay]);

  const eligibleBarbeirosForEdit = useMemo(() => {
    if (!selectedReserva) return [];

    const selectedService = servicos.find((servico) => servico.id_servico === selectedReserva.id_servico);
    if (!selectedService) return barbeiros;

    const eligibleIds = new Set(
      barbeiroEspecialidades
        .filter((link) => Number(link.id_especialidade) === Number(selectedService.id_especialidade))
        .map((link) => Number(link.id_barbeiro))
    );

    return barbeiros.filter((barbeiro) => eligibleIds.has(Number(barbeiro.id_barbeiro)));
  }, [selectedReserva, servicos, barbeiroEspecialidades, barbeiros]);

  const editAvailableTimeOptions = useMemo(() => {
    if (!selectedReserva || !editData.id_barbeiro) return [];

    const selectedDateKey = normalizeYmd(selectedReserva.data);
    const desiredSize = Math.min(4, Math.max(1, Number(selectedReserva.tempo_medio) || 1));
    const occupiedSlots = new Set<number>();

    for (const reserva of reservas) {
      if (reserva.id_reserva === selectedReserva.id_reserva) continue;
      if (Number(reserva.id_barbeiro) !== Number(editData.id_barbeiro)) continue;
      if (normalizeYmd(reserva.data) !== selectedDateKey) continue;

      const startSlot = toSlotIndex(reserva.horario_inicial);
      if (startSlot < 0 || startSlot >= SLOT_COUNT) continue;

      const size = Math.min(4, Math.max(1, Number(reserva.tempo_medio) || 1));
      for (let slot = startSlot; slot < startSlot + size; slot += 1) {
        if (slot >= 0 && slot < SLOT_COUNT) occupiedSlots.add(slot);
      }
    }

    const now = new Date();
    const todayKey = toYmd(startOfDay(now));
    const isToday = selectedDateKey === todayKey;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const times: string[] = [];

    for (let startSlot = 0; startSlot <= SLOT_COUNT - desiredSize; startSlot += 1) {
      let canUse = true;
      for (let check = startSlot; check < startSlot + desiredSize; check += 1) {
        if (occupiedSlots.has(check)) {
          canUse = false;
          break;
        }
      }

      if (!canUse) continue;

      const totalMinutes = SLOT_START_HOUR * 60 + startSlot * SLOT_MINUTES;
      if (isToday && totalMinutes <= nowMinutes) continue;

      const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
      const mm = String(totalMinutes % 60).padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }

    return times;
  }, [selectedReserva, editData.id_barbeiro, reservas]);

  // Funcao responsavel por buscar reservas da API considerando perfil do usuario, semana selecionada e cancelamentos.
  const loadReservas = async (startDate?: Date, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const includeCanceledParam = isCliente ? "true" : "false";
    const endpoint = startDate
      ? `/reservas?weekStart=${toYmd(startDate)}&includeCanceled=${includeCanceledParam}`
      : `/reservas?includeCanceled=${includeCanceledParam}`;
    const res = await request(endpoint, { method: "GET" });
    if (!silent) {
      setLoading(false);
    }

    if (!res.ok) {
      setReservas([]);
      setError(res.message || "Não foi possível carregar reservas.");
      return;
    }

    const rawReservas: ReservaItem[] = Array.isArray(res.data?.reservas) ? res.data.reservas : [];
    setReservas(rawReservas);
  };

  // Funcao responsavel por carregar dados completos de reservas para alimentar indicadores estatisticos do painel.
  const loadStatsReservas = async () => {
    const res = await request("/reservas?includeCanceled=true", { method: "GET" });

    if (!res.ok) {
      setStatsReservas([]);
      return;
    }

    const rawReservas: ReservaItem[] = Array.isArray(res.data?.reservas) ? res.data.reservas : [];
    setStatsReservas(rawReservas);
  };

  useEffect(() => {
    if (isCliente) {
      loadReservas();
      return;
    }

    loadReservas(weekStart, { silent: true });
  }, [weekStart, isCliente]);

  useEffect(() => {
    if (isCliente) {
      setStatsReservas([]);
      return;
    }

    loadStatsReservas();
  }, [isCliente]);

  useEffect(() => {
    if (isCliente) return;

    const timer = setInterval(() => {
      loadReservas(weekStart, { silent: true });
      loadStatsReservas();
    }, BARBER_AUTO_REFRESH_MS);

    return () => clearInterval(timer);
  }, [isCliente, weekStart]);

  useEffect(() => {
    if (isCliente) return;

    // Funcao responsavel por carregar barbeiros, servicos e vinculos necessarios para editar reservas no calendario.
    const loadSchedulingRules = async () => {
      const [barbeirosRes, servicosRes, linksRes] = await Promise.all([
        request("/barbeiros", { method: "GET" }),
        request("/servicos", { method: "GET" }),
        request("/barbeiro-especialidades", { method: "GET" }),
      ]);

      if (!barbeirosRes.ok || !servicosRes.ok || !linksRes.ok) {
        setBarbeiros([]);
        setServicos([]);
        setBarbeiroEspecialidades([]);
        return;
      }

      setBarbeiros(Array.isArray(barbeirosRes.data?.barbeiros) ? barbeirosRes.data.barbeiros : []);
      setServicos(
        Array.isArray(servicosRes.data?.servicos)
          ? servicosRes.data.servicos.map((servico: { id_servico: number; id_especialidade: number }) => ({
              id_servico: Number(servico.id_servico),
              id_especialidade: Number(servico.id_especialidade),
            }))
          : []
      );
      setBarbeiroEspecialidades(
        Array.isArray(linksRes.data?.barbeiro_especialidades)
          ? linksRes.data.barbeiro_especialidades.map(
              (link: { id_barbeiro: number; id_especialidade: number }) => ({
                id_barbeiro: Number(link.id_barbeiro),
                id_especialidade: Number(link.id_especialidade),
              })
            )
          : []
      );
    };

    loadSchedulingRules();
  }, [isCliente, request]);

  // Funcao responsavel por abrir o dialogo de edicao de reserva com dados pre-preenchidos.
  const openEditDialog = (reserva: ReservaItem) => {
    if (!isCliente && hasReservaStarted(reserva)) {
      return;
    }

    setSelectedReserva(reserva);
    setEditData({
      id_barbeiro: reserva.id_barbeiro,
      horario_inicial: reserva.horario_inicial.slice(0, 5),
    });
    setOpenEdit(true);
  };

  // Funcao responsavel por fechar o dialogo de edicao e restaurar estado padrao dos campos.
  const closeEditDialog = () => {
    setOpenEdit(false);
    setSelectedReserva(null);
    setEditData({ id_barbeiro: 0, horario_inicial: "" });
  };

  // Funcao responsavel por persistir alteracoes de reserva e recarregar dados apos atualizacao.
  const handleUpdateReserva = async () => {
    if (!selectedReserva) return;

    setError(null);
    setSuccess(null);

    if (!isCliente && hasReservaStarted(selectedReserva)) {
      return;
    }

    if (!editData.id_barbeiro || !editData.horario_inicial) {
      setError("Barbeiro e horário são obrigatórios.");
      return;
    }

    setLoading(true);
    const res = await request(`/reservas/${selectedReserva.id_reserva}`, {
      method: "PUT",
      body: JSON.stringify({
        id_barbeiro: editData.id_barbeiro,
        horario_inicial: `${editData.horario_inicial}:00`,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.message || "Não foi possível atualizar a reserva.");
      return;
    }

    setSuccess("Reserva atualizada com sucesso.");
    closeEditDialog();
    loadReservas(isCliente ? undefined : weekStart);
    if (!isCliente) {
      loadStatsReservas();
    }
  };

  // Funcao responsavel por cancelar/excluir reserva com regras de permissao e confirmacao conforme perfil.
  const deleteReserva = async (reserva: ReservaItem) => {
    if (isCliente && !canClienteCancelReserva(reserva)) {
      setError("Cancelamento permitido apenas até 2 horas antes do horário da reserva.");
      return;
    }

    if (isCliente) {
      const confirmed = window.confirm("Tem certeza que deseja cancelar este agendamento?");
      if (!confirmed) return;
    }

    setLoading(true);
    const res = await request(`/reservas/${reserva.id_reserva}`, {
      method: "DELETE",
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.message || "Não foi possível excluir a reserva.");
      return;
    }

    setSuccess("Reserva excluída com sucesso.");
    closeEditDialog();
    loadReservas(isCliente ? undefined : weekStart);
    if (!isCliente) {
      loadStatsReservas();
    }
  };

  // Funcao responsavel por acionar exclusao da reserva atualmente selecionada no dialogo.
  const handleDeleteReserva = async () => {
    if (!selectedReserva) return;
    await deleteReserva(selectedReserva);
  };

  const activeReservas = useMemo(() => {
    const now = clockTick;
    return reservas
      .filter((reserva) => {
        if (isReservaCanceled(reserva)) return false;
        const dateKey = normalizeYmd(reserva.data);
        return new Date(`${dateKey}T${reserva.horario_inicial}`).getTime() >= now;
      })
      .sort((a, b) => {
        const left = `${normalizeYmd(a.data)} ${a.horario_inicial}`;
        const right = `${normalizeYmd(b.data)} ${b.horario_inicial}`;
        return left.localeCompare(right);
      });
  }, [reservas, clockTick]);

  const pastReservas = useMemo(() => {
    const now = clockTick;
    return reservas
      .filter((reserva) => {
        if (isReservaCanceled(reserva)) return true;
        const dateKey = normalizeYmd(reserva.data);
        return new Date(`${dateKey}T${reserva.horario_inicial}`).getTime() < now;
      })
      .sort((a, b) => {
        const aCanceled = isReservaCanceled(a) ? 1 : 0;
        const bCanceled = isReservaCanceled(b) ? 1 : 0;
        if (aCanceled !== bCanceled) return bCanceled - aCanceled;
        const left = `${normalizeYmd(b.data)} ${b.horario_inicial}`;
        const right = `${normalizeYmd(a.data)} ${a.horario_inicial}`;
        return left.localeCompare(right);
      });
  }, [reservas, clockTick]);

  const completedReservas = useMemo(() => {
    return pastReservas.filter((reserva) => !isReservaCanceled(reserva));
  }, [pastReservas]);

  const canceledReservas = useMemo(() => {
    return [...reservas]
      .filter((reserva) => isReservaCanceled(reserva))
      .sort((a, b) => {
        const left = `${normalizeYmd(b.data)} ${b.horario_inicial}`;
        const right = `${normalizeYmd(a.data)} ${a.horario_inicial}`;
        return left.localeCompare(right);
      });
  }, [reservas]);

  const visibleHistoryReservas = historyTab === "cancelados" ? canceledReservas : completedReservas;

  // Funcao responsavel por formatar data curta das reservas exibidas nos cards de historico do cliente.
  const getReservaCardDateLabel = (reserva: ReservaItem) => {
    const reservaDate = parseYmdLocal(reserva.data);
    if (!reservaDate) return normalizeYmd(reserva.data);
    return dateFormatter.format(reservaDate);
  };

  const todayKey = toYmd(startOfDay(new Date(clockTick)));

  const dashboardStats = useMemo(() => {
    const baseStatsReservas = isCliente ? reservas : statsReservas;
    const sourceReservas =
      !isCliente && calendarBarbeiroId !== "all"
        ? baseStatsReservas.filter((reserva) => Number(reserva.id_barbeiro) === Number(calendarBarbeiroId))
        : baseStatsReservas;

    const calendarBaseDate = startOfDay(weekStart);
    const calendarMonth = calendarBaseDate.getMonth();
    const calendarYear = calendarBaseDate.getFullYear();
    const weekEndKey = toYmd(addDays(startOfDay(new Date(clockTick)), 6));

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    let canceledCount = 0;
    let activeCount = 0;

    for (const reserva of sourceReservas) {
      const dateKey = normalizeYmd(reserva.data);
      const canceled = isReservaCanceled(reserva);
      const reservaDateTime = new Date(`${dateKey}T${reserva.horario_inicial}`).getTime();

      if (canceled) {
        canceledCount += 1;
        continue;
      }

      const parsedDate = parseYmdLocal(dateKey);
      if (parsedDate && parsedDate.getMonth() === calendarMonth && parsedDate.getFullYear() === calendarYear) {
        monthCount += 1;
      }

      if (reservaDateTime >= clockTick) {
        activeCount += 1;
      }

      if (dateKey === todayKey) {
        todayCount += 1;
      }

      if (dateKey >= todayKey && dateKey <= weekEndKey) {
        weekCount += 1;
      }

    }

    return [
      { label: "Hoje", value: todayCount },
      { label: "Semana", value: weekCount },
      { label: "Mês", value: monthCount },
      { label: "Ativos", value: activeCount },
      { label: "Cancelados", value: canceledCount },
    ];
  }, [
    isCliente,
    reservas,
    statsReservas,
    calendarBarbeiroId,
    weekStart,
    todayKey,
    clockTick,
  ]);

  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        py: 2,
        px: { xs: 1, sm: 1.5, md: 2 },
      }}
    >
      <Paper
        variant="outlined"
        className="fade-in-page"
        sx={(theme) => ({
          display: isCliente ? "block" : "none",
          mb: 3,
          p: { xs: 2, md: 3 },
          position: "relative",
          overflow: "hidden",
          borderColor: "rgba(233, 108, 79, 0.38)",
          background:
            theme.palette.mode === "dark"
              ? "radial-gradient(120% 140% at 0% 0%, rgba(233,108,79,0.20) 0%, rgba(1,50,95,0.45) 42%, rgba(0,0,0,0.95) 100%)"
              : "radial-gradient(120% 140% at 0% 0%, rgba(233,108,79,0.22) 0%, rgba(1,50,95,0.08) 42%, rgba(255,255,255,1) 100%)",
        })}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.8,
            alignItems: "stretch",
          }}
        >
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
              Painel Nicatto Beard
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.2, mb: 0 }}>
              Olá, {user?.name}.
            </Typography>
          </Box>

          {!isCliente && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" },
                gap: 0.6,
              }}
            >
              {dashboardStats.map((item, idx) => (
                <Paper
                  key={item.label}
                  variant="outlined"
                  sx={(theme) => ({
                    p: 1.2,
                    borderColor: idx % 2 === 0 ? "rgba(1, 50, 95, 0.45)" : "rgba(233, 108, 79, 0.55)",
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? idx % 2 === 0
                          ? "rgba(1, 50, 95, 0.30)"
                          : "rgba(233, 108, 79, 0.22)"
                        : idx % 2 === 0
                        ? "rgba(1, 50, 95, 0.06)"
                        : "rgba(233, 108, 79, 0.12)",
                  })}
                >
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                    {item.value}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      </Paper>

      <Box sx={{ mt: 1 }}>
        {isCliente && (
          <>
            <Button
              variant="contained"
              color="secondary"
              size="medium"
              fullWidth
              sx={{ py: 1, fontWeight: 600, mb: 1.2 }}
              onClick={onOpenSchedulePage}
            >
              Agendar Serviço
            </Button>

            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 1 }}>{success}</Alert>}

            <Paper variant="outlined" sx={{ p: 1.2, mb: 1.2 }}>
              <Typography variant="body2" sx={{ mb: 0.8, fontWeight: 600 }}>
                Agendamentos ativos
              </Typography>
              {loading && (
                <Stack spacing={1.2} sx={{ mb: 1.2 }}>
                  {[0, 1].map((idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                      <Skeleton variant="text" width="70%" height={28} />
                      <Skeleton variant="text" width="50%" />
                    </Paper>
                  ))}
                </Stack>
              )}
              <Stack spacing={1.2}>
                {activeReservas.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Você não possui agendamentos ativos.
                  </Typography>
                )}
                {activeReservas.map((reserva) => (
                  <Card key={reserva.id_reserva} variant="outlined" className="fade-in-page">
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {getActiveReservaDateLabel(reserva)} às {reserva.horario_inicial.slice(0, 5)} - {reserva.servico_nome}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Barbeiro: {reserva.barbeiro_nome}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ px: 1.5, pt: 0, pb: 1.2 }}>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        disabled={!canClienteCancelReserva(reserva) || loading}
                        onClick={() => {
                          setError(null);
                          setSuccess(null);
                          deleteReserva(reserva);
                        }}
                      >
                        Cancelar agendamento
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Cancelamento disponível até {CLIENT_CANCEL_LIMIT_HOURS} horas antes da reserva.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 700 }}>
                Últimos agendamentos
              </Typography>
              <Tabs
                value={historyTab}
                onChange={(_, value: "realizados" | "cancelados") => setHistoryTab(value)}
                sx={{ mb: 1.2 }}
              >
                <Tab value="realizados" label="Realizados" />
                <Tab value="cancelados" label="Cancelados" />
              </Tabs>
              {loading && (
                <Stack spacing={1.2} sx={{ mb: 1.2 }}>
                  {[0, 1, 2].map((idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                      <Skeleton variant="text" width="75%" height={26} />
                      <Skeleton variant="text" width="45%" />
                    </Paper>
                  ))}
                </Stack>
              )}
              <Stack spacing={1.2}>
                {visibleHistoryReservas.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {historyTab === "cancelados"
                      ? "Nenhum agendamento cancelado encontrado."
                      : "Nenhum agendamento anterior encontrado."}
                  </Typography>
                )}
                {visibleHistoryReservas.slice(0, 10).map((reserva) => (
                  <Card key={reserva.id_reserva} variant="outlined" className="fade-in-page">
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {getReservaCardDateLabel(reserva)} às {reserva.horario_inicial.slice(0, 5)} - {reserva.servico_nome}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Barbeiro: {reserva.barbeiro_nome}
                      </Typography>
                      {isReservaCanceled(reserva) && (
                        <Typography variant="caption" display="block" color="error.main" sx={{ fontWeight: 700 }}>
                          Cancelado
                        </Typography>
                      )}
                      {!isReservaCanceled(reserva) && (
                        <Typography variant="caption" display="block" color="success.main" sx={{ fontWeight: 700 }}>
                          Realizado
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Paper>
          </>
        )}

        {!isCliente && (
          <>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

            <Box
              sx={{
                mt: 1,
                display: "grid",
                gap: 1,
                alignItems: "start",
                width: "100%",
                maxWidth: "100%",
                overflowX: "hidden",
                gridTemplateColumns: { xs: "1fr", lg: "220px minmax(0, 1fr)" },
              }}
            >
              <Paper
                variant="outlined"
                className="fade-in-page"
                sx={{
                  p: 1.1,
                  borderColor: "rgba(1, 50, 95, 0.36)",
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: "-0.01em" }}>
                  Painel Nicatto Beard
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.2, mb: 0.8 }}>
                  Olá, {user?.name}.
                </Typography>
                <Stack
                  direction={{ xs: "row", lg: "column" }}
                  spacing={0.6}
                  sx={{
                    flexWrap: { xs: "wrap", lg: "nowrap" },
                    overflowX: "hidden",
                    pb: { xs: 0.4, lg: 0 },
                    scrollbarWidth: "thin",
                  }}
                >
                  {dashboardStats.map((item, idx) => (
                    <Paper
                      key={`side-stat-${item.label}`}
                      variant="outlined"
                      sx={(theme) => ({
                        width: { xs: "calc(33.333% - 4px)", lg: "100%" },
                        minWidth: 0,
                        flexShrink: 0,
                        p: 0.8,
                        borderColor: idx % 2 === 0 ? "rgba(1, 50, 95, 0.4)" : "rgba(233, 108, 79, 0.5)",
                        backgroundColor:
                          theme.palette.mode === "dark"
                            ? idx % 2 === 0
                              ? "rgba(1, 50, 95, 0.22)"
                              : "rgba(233, 108, 79, 0.14)"
                            : idx % 2 === 0
                            ? "rgba(1, 50, 95, 0.05)"
                            : "rgba(233, 108, 79, 0.10)",
                      })}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                        {item.value}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Paper>

            <Paper
              variant="outlined"
              sx={(theme) => ({
                mt: 1,
                p: 0.8,
                borderRadius: 2,
                borderColor: "rgba(233, 108, 79, 0.42)",
                background:
                  theme.palette.mode === "dark"
                    ? "linear-gradient(180deg, rgba(1,50,95,0.42) 0%, rgba(0,0,0,1) 100%)"
                    : "linear-gradient(180deg, rgba(1,50,95,0.06) 0%, rgba(255,255,255,1) 100%)",
              })}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={0.8}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", md: "center" }}
                sx={{ mb: 0.8 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {isMobile ? "Calendário diário de reservas" : "Calendário semanal de reservas"}
                </Typography>
                {isBarberNonAdmin ? (
                  <Button variant="outlined" size="small" disabled>
                    {isMobile ? "Dia atual" : "Semana atual"}
                  </Button>
                ) : (
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={0.8}
                    sx={{
                      width: { xs: '100%', md: 'auto' },
                      ml: { md: 'auto' },
                      alignItems: { md: 'flex-start' },
                    }}
                  >
                    <FormControl size="small" sx={{ minWidth: 0, width: { xs: "100%", md: 180 } }}>
                      <InputLabel id="calendar-barbeiro-filter-label">Barbeiro</InputLabel>
                      <Select
                        labelId="calendar-barbeiro-filter-label"
                        label="Barbeiro"
                        value={calendarBarbeiroId}
                        onChange={(e) => {
                          const next = e.target.value;
                          setCalendarBarbeiroId(next === "all" ? "all" : Number(next));
                        }}
                      >
                        <MenuItem value="all">Todos os barbeiros</MenuItem>
                        {calendarBarberOptions.map((barbeiro) => (
                          <MenuItem key={barbeiro.id} value={barbeiro.id}>
                            {barbeiro.nome}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Stack
                      direction="row"
                      spacing={0.6}
                      sx={{
                        width: { xs: '100%', md: 'auto' },
                        justifyContent: { md: 'flex-end' },
                        '& .MuiButton-root': {
                          flex: { xs: 1, md: '0 0 auto' },
                          minWidth: 0,
                          px: { xs: 0.6, md: 1.2 },
                          fontSize: { xs: '0.68rem', md: '0.8125rem' },
                          whiteSpace: 'nowrap',
                        },
                      }}
                    >
                      <Button size="small" variant="outlined" onClick={() => setWeekStart((prev) => addDays(prev, isMobile ? -1 : -7))}>
                        {isMobile ? "Dia anterior" : "Semana anterior"}
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => setWeekStart(startOfDay(new Date()))}>
                        {isMobile ? "Dia atual" : "Semana atual"}
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => setWeekStart((prev) => addDays(prev, isMobile ? 1 : 7))}>
                        {isMobile ? "Próximo dia" : "Próxima semana"}
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </Stack>

              <Box
                sx={{
                  overflowX: "hidden",
                  overflowY: "visible",
                  width: "100%",
                  maxWidth: "100%",
                }}
              >
                <Paper
                  variant="outlined"
                  sx={(theme) => ({
                    minWidth: 0,
                    width: "100%",
                    maxWidth: "100%",
                    p: { xs: 0.45, sm: 0.8 },
                    display: "grid",
                    gridTemplateColumns: `${isMobile ? 44 : 54}px repeat(${visibleCalendarDays.length}, minmax(0, 1fr))`,
                    gap: { xs: 0.35, sm: 0.6 },
                    borderRadius: 2,
                    borderColor: "rgba(233, 108, 79, 0.38)",
                    background:
                      theme.palette.mode === "dark"
                        ? "linear-gradient(180deg, rgba(1,50,95,0.2), rgba(0,0,0,0.82))"
                        : "linear-gradient(180deg, rgba(1,50,95,0.04), rgba(255,255,255,1))",
                  })}
                >
                  <Box />
                  {visibleCalendarDays.map((day) => (
                    <Box
                      key={`header-${day.key}`}
                      sx={{
                        px: 0.8,
                        py: 0.65,
                        borderRadius: 1,
                        backgroundColor: day.key === todayKey ? "rgba(233, 108, 79, 0.2)" : "rgba(1, 50, 95, 0.14)",
                        border: "1px solid",
                        borderColor: day.key === todayKey ? "rgba(233, 108, 79, 0.65)" : "rgba(1, 50, 95, 0.35)",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: { xs: "0.72rem", md: "0.8rem" }, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {day.label}
                      </Typography>
                    </Box>
                  ))}

                  <Box sx={{ position: "relative", height: SLOT_COUNT * SLOT_PX }}>
                    {calendarSlots.map((slot) => (
                      <Box
                        key={`time-${slot.idx}`}
                        sx={{
                          position: "absolute",
                          top: slot.idx * SLOT_PX - 8,
                          left: 0,
                          width: "100%",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {slot.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {visibleCalendarDays.map((day) => (
                    <Box
                      key={`column-${day.key}`}
                      sx={{
                        position: "relative",
                        height: SLOT_COUNT * SLOT_PX,
                        border: "1px solid",
                        borderColor: day.key === todayKey ? "rgba(233, 108, 79, 0.58)" : "divider",
                        borderRadius: 1.5,
                        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${SLOT_PX - 1}px, rgba(120, 130, 150, 0.16) ${SLOT_PX - 1}px, rgba(120, 130, 150, 0.16) ${SLOT_PX}px), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.08))`,
                        boxShadow: day.key === todayKey ? "0 0 0 1px rgba(233,108,79,0.22), 0 10px 18px rgba(0,0,0,0.18)" : "none",
                      }}
                    >
                      {nowIndicator && day.key === nowIndicator.todayKey && (
                        <>
                          <Box
                            sx={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              top: nowIndicator.topPx,
                              height: 2,
                              bgcolor: "error.main",
                              zIndex: 2,
                              pointerEvents: "none",
                            }}
                          />
                          <Box
                            sx={{
                              position: "absolute",
                              top: nowIndicator.topPx - 10,
                              right: 6,
                              px: 0.6,
                              py: 0.1,
                              borderRadius: 0.8,
                              fontSize: "0.65rem",
                              lineHeight: 1.3,
                              fontWeight: 700,
                              color: "error.contrastText",
                              bgcolor: "error.main",
                              zIndex: 3,
                              pointerEvents: "none",
                            }}
                          >
                            {nowIndicator.label}
                          </Box>
                        </>
                      )}

                      {(reservasByDay[day.key] || []).map((reserva) => {
                        const slotIndex = toSlotIndex(reserva.horario_inicial);
                        if (slotIndex < 0 || slotIndex >= SLOT_COUNT) return null;

                        const hasStarted = getReservaStartTime(reserva).getTime() <= clockTick;
                        const durationSlots = Math.min(4, Math.max(1, Number(reserva.tempo_medio) || 1));
                        const blockHeight = Math.min(durationSlots, SLOT_COUNT - slotIndex) * SLOT_PX - 4;
                        const lane = dayLaneMap[reserva.id_reserva] || { laneIndex: 0, laneCount: 1 };
                        const laneWidth = 100 / lane.laneCount;
                        const blockColor = reserva.barbeiro_cor || barberColorById[Number(reserva.id_barbeiro)] || "#01325f";
                        const textColor = getTextColorByHex(blockColor);

                        return (
                          <Box
                            key={reserva.id_reserva}
                            onClick={() => openEditDialog(reserva)}
                            sx={{
                              position: "absolute",
                              left: `calc(${lane.laneIndex * laneWidth}% + 2px)`,
                              width: `calc(${laneWidth}% - 4px)`,
                              top: slotIndex * SLOT_PX + 2,
                              minHeight: 28,
                              height: blockHeight,
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: "rgba(0,0,0,0.26)",
                              bgcolor: blockColor,
                              color: textColor,
                              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                              opacity: hasStarted ? 0.45 : 0.92,
                              cursor: hasStarted ? "not-allowed" : "pointer",
                              filter: hasStarted ? "grayscale(0.55)" : "none",
                              pointerEvents: hasStarted ? "none" : "auto",
                              overflow: "hidden",
                              '&:hover': { opacity: 1 },
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700, display: "block", lineHeight: 1.2 }}>
                              {reserva.horario_inicial.slice(0, 5)} • {reserva.servico_nome}
                            </Typography>
                            <Typography variant="caption" sx={{ display: "block", lineHeight: 1.2 }}>
                              {reserva.cliente_nome}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  ))}
                </Paper>
            </Box>
            </Paper>
            </Box>
          </>
        )}
      </Box>

      <Dialog open={openEdit} onClose={closeEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Detalhes do agendamento</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {selectedReserva && (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Informações atuais
              </Typography>
              <Typography variant="body2">Data: {normalizeYmd(selectedReserva.data)}</Typography>
              <Typography variant="body2">Horário: {selectedReserva.horario_inicial.slice(0, 5)}</Typography>
              <Typography variant="body2">Serviço: {selectedReserva.servico_nome}</Typography>
              <Typography variant="body2">Cliente: {selectedReserva.cliente_nome}</Typography>
              <Typography variant="body2">Barbeiro: {selectedReserva.barbeiro_nome}</Typography>
            </Paper>
          )}

          <FormControl fullWidth>
            <InputLabel id="edit-barbeiro-label">Novo barbeiro</InputLabel>
            <Select
              labelId="edit-barbeiro-label"
              label="Novo barbeiro"
              value={editData.id_barbeiro}
              onChange={(e) => setEditData((prev) => ({ ...prev, id_barbeiro: Number(e.target.value) }))}
            >
              {eligibleBarbeirosForEdit.map((barbeiro) => (
                <MenuItem key={barbeiro.id_barbeiro} value={barbeiro.id_barbeiro}>
                  {barbeiro.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="edit-horario-label">Novo horário</InputLabel>
            <Select
              labelId="edit-horario-label"
              label="Novo horário"
              value={editData.horario_inicial}
              onChange={(e) => setEditData((prev) => ({ ...prev, horario_inicial: String(e.target.value) }))}
            >
              {editAvailableTimeOptions.map((time) => (
                <MenuItem key={time} value={time}>
                  {time}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedReserva && editAvailableTimeOptions.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Não há horários disponíveis para este barbeiro nesse dia.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
          <Button
            color="error"
            onClick={handleDeleteReserva}
            disabled={Boolean(isCliente && selectedReserva && !canClienteCancelReserva(selectedReserva))}
          >
            Cancelar agendamento
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={closeEditDialog}>Cancelar</Button>
            <Button variant="contained" onClick={handleUpdateReserva}>
              Salvar
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
