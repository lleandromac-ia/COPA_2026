export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

export function isAdmin() {
  return sessionStorage.getItem('bolao_admin') === 'true';
}

export function setAdmin(value) {
  if (value) sessionStorage.setItem('bolao_admin', 'true');
  else sessionStorage.removeItem('bolao_admin');
}

export function exportTableToCSV(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Nome completo do participante (referência em todo o sistema) */
export function getNomeParticipante(participante) {
  return String(participante?.nome || '').trim();
}

export const GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const FUSO_BRASIL = 'America/Sao_Paulo';

export function formatarDataJogo(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BRASIL, day: '2-digit' }).format(d);
  const mesNum = parseInt(new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BRASIL, month: 'numeric' }).format(d), 10);
  const mes = MESES_ABREV[mesNum - 1] || '???';
  const semRaw = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BRASIL, weekday: 'short' }).format(d);
  const sem = semRaw.replace('.', '').slice(0, 3).toLowerCase();
  return `${dia}-${mes} (${sem})`;
}

export function formatarHoraJogo(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', {
    timeZone: FUSO_BRASIL,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Converte data/hora da planilha (horário de Brasília) para ISO UTC. */
export function parseDataJogoBrasilia(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  const match = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/);
  if (match) {
    const [, date, hh, mm] = match;
    const d = new Date(`${date}T${hh.padStart(2, '0')}:${mm}:00-03:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function numeroJogo(codigo) {
  const match = String(codigo || '').match(/(\d{2})$/);
  return match ? match[1] : codigo;
}
