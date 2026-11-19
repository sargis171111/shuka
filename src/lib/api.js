export const ARMENIA_REGIONS = [
  'Yerevan',
  'Aragatsotn',
  'Ararat',
  'Armavir',
  'Gegharkunik',
  'Kotayk',
  'Lori',
  'Shirak',
  'Syunik',
  'Tavush',
  'Vayots Dzor',
];

export const STATUS_STYLES = {
  placed: { label: 'Placed', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  confirmed: { label: 'Confirmed', bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500' },
  shipped: { label: 'Shipped', bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' },
  delivered: { label: 'Delivered', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
};

export function formatAmd(amount) {
  const num = Number(amount || 0);
  return `${Math.round(num).toLocaleString('en-US')} ֏`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };
  if (!isFormData && options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers,
    body:
      !isFormData && options.body !== undefined && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  });

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  }

  if (!res.ok) {
    const err = data?.error || {};
    throw new ApiError(
      res.status,
      err.code || 'REQUEST_FAILED',
      err.message || `Request failed with status ${res.status}`,
      err
    );
  }

  return data;
}
