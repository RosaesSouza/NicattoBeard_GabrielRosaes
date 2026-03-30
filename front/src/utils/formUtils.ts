// Funcao responsavel por remover qualquer caractere nao numerico de um texto para facilitar validacao e mascaramento.
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// Funcao responsavel por aplicar mascara brasileira de telefone dinamicamente conforme a quantidade de digitos informada.
export function formatPhoneBR(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Funcao responsavel por validar se o email segue o formato basico aceito pelos formularios da aplicacao.
export function isValidEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

// Funcao responsavel por validar regra de senha forte com maiuscula, minuscula, numero, simbolo e tamanho minimo.
export function isStrongPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,128}$/.test(password);
}

// Funcao responsavel por verificar se a data informada representa idade minima de 18 anos.
export function isAdultDate(dateISO: string): boolean {
  const date = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const limit = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return date <= limit;
}

// Funcao responsavel por impedir datas futuras em campos que aceitam apenas datas passadas ou atuais.
export function isNotFutureDate(dateISO: string): boolean {
  const date = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date <= todayNoTime;
}

// Funcao responsavel por converter entrada numerica em moeda no padrao brasileiro com duas casas decimais.
export function maskCurrencyBR(input: string): string {
  const digits = onlyDigits(input);
  const cents = Number(digits || '0');
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Funcao responsavel por formatar numero bruto para exibicao monetaria no padrao pt-BR.
export function numberToCurrencyBR(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Funcao responsavel por transformar texto monetario brasileiro em numero para calculos e envio de payload.
export function currencyBRToNumber(masked: string): number {
  const normalized = masked.replace(/\./g, '').replace(',', '.').trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

// Funcao responsavel por padronizar mensagens de erro tecnicas em textos amigaveis para exibicao na interface.
export function normalizeUiError(message?: string): string {
  if (!message) return 'Não foi possível concluir a operação. Tente novamente.';

  const normalized = message.trim();
  const map: Record<string, string> = {
    'Erro no servidor.': 'Erro interno no servidor. Tente novamente em instantes.',
    'Token ausente.': 'Sessão expirada. Faça login novamente.',
    'Token inválido ou expirado.': 'Sessão expirada. Faça login novamente.',
    'Permissão negada': 'Você não tem permissão para realizar esta ação.',
  };

  return map[normalized] || normalized;
}
