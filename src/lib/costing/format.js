/**
 * Formatting for the cost pages. Money is always stored in VND; only the
 * display switches, so nothing here ever mutates a stored price.
 */

export function toDisplay(vnd, commercial = {}) {
  if (commercial.currency === 'USD') {
    const rate = Number(commercial.usdRate) || 1;
    return (Number(vnd) || 0) / rate;
  }
  return Number(vnd) || 0;
}

export function formatMoney(vnd, commercial = {}, { compact = false } = {}) {
  const value = toDisplay(vnd, commercial);
  if (!Number.isFinite(value)) return '—';
  if (commercial.currency === 'USD') {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (compact && Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}M ₫`;
  }
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

/** Both currencies at once, for totals where the second one is useful. */
export function formatMoneyBoth(vnd, commercial = {}) {
  const primary = formatMoney(vnd, commercial);
  const other =
    commercial.currency === 'USD'
      ? formatMoney(vnd, { ...commercial, currency: 'VND' })
      : formatMoney(vnd, { ...commercial, currency: 'USD' });
  return `${primary} · ${other}`;
}

export function formatMass(grams) {
  if (!Number.isFinite(grams)) return '—';
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  if (grams >= 10) return `${grams.toFixed(1)} g`;
  return `${grams.toFixed(2)} g`;
}

export function formatVolume(mm3) {
  if (!Number.isFinite(mm3)) return '—';
  const cm3 = mm3 / 1000;
  if (cm3 >= 1000) return `${(cm3 / 1000).toFixed(2)} dm³`;
  if (cm3 >= 1) return `${cm3.toFixed(2)} cm³`;
  return `${mm3.toFixed(1)} mm³`;
}

export function formatArea(mm2) {
  if (!Number.isFinite(mm2)) return '—';
  const cm2 = mm2 / 100;
  if (cm2 >= 10000) return `${(cm2 / 10000).toFixed(2)} m²`;
  return `${cm2.toFixed(1)} cm²`;
}

export function formatMinutes(min) {
  if (!Number.isFinite(min)) return '—';
  if (min < 1) return `${Math.round(min * 60)} s`;
  if (min < 60) return `${min.toFixed(1)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatPct(value, digits = 0) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}
