import { Parser } from 'expr-eval';

export function createConfiguredParser(): Parser {
  const parser = new Parser({
    operators: {
      logical: true,
      comparison: true,
      concatenate: true,
    },
  });

  const customFunctions: Record<string, Function> = {
    // 1. Math & Rounding
    abs: (x: any) => Math.abs(Number(x) || 0),
    sqrt: (x: any) => Math.sqrt(Math.max(0, Number(x) || 0)),
    round: (x: any, d: any = 0) => {
      const decimals = Number(d) || 0;
      const factor = Math.pow(10, decimals);
      return Math.round((Number(x) || 0) * factor) / factor;
    },
    roundup: (x: any, d: any = 0) => {
      const decimals = Number(d) || 0;
      const factor = Math.pow(10, decimals);
      return Math.ceil((Number(x) || 0) * factor) / factor;
    },
    rounddown: (x: any, d: any = 0) => {
      const decimals = Number(d) || 0;
      const factor = Math.pow(10, decimals);
      return Math.floor((Number(x) || 0) * factor) / factor;
    },
    ceil: (x: any) => Math.ceil(Number(x) || 0),
    ceiling: (x: any) => Math.ceil(Number(x) || 0),
    floor: (x: any) => Math.floor(Number(x) || 0),
    trunc: (x: any, d: any = 0) => {
      const decimals = Number(d) || 0;
      const factor = Math.pow(10, decimals);
      return Math.trunc((Number(x) || 0) * factor) / factor;
    },
    int: (x: any) => Math.trunc(Number(x) || 0),
    sign: (x: any) => Math.sign(Number(x) || 0),
    mod: (x: any, y: any) => (Number(y) === 0 ? 0 : (Number(x) || 0) % Number(y)),
    power: (x: any, y: any) => Math.pow(Number(x) || 0, Number(y) || 0),
    pow: (x: any, y: any) => Math.pow(Number(x) || 0, Number(y) || 0),
    exp: (x: any) => Math.exp(Number(x) || 0),
    log: (x: any) => Math.log(Math.max(1e-12, Number(x) || 0)),
    ln: (x: any) => Math.log(Math.max(1e-12, Number(x) || 0)),
    log10: (x: any) => Math.log10(Math.max(1e-12, Number(x) || 0)),

    // 2. Statistical & Aggregation
    min: (...args: any[]) => {
      const flat = args.flat().map((v) => Number(v) || 0);
      return flat.length === 0 ? 0 : Math.min(...flat);
    },
    max: (...args: any[]) => {
      const flat = args.flat().map((v) => Number(v) || 0);
      return flat.length === 0 ? 0 : Math.max(...flat);
    },
    avg: (...args: any[]) => {
      const flat = args.flat().map((v) => Number(v) || 0);
      if (flat.length === 0) return 0;
      return flat.reduce((a, b) => a + b, 0) / flat.length;
    },
    average: (...args: any[]) => {
      const flat = args.flat().map((v) => Number(v) || 0);
      if (flat.length === 0) return 0;
      return flat.reduce((a, b) => a + b, 0) / flat.length;
    },
    sum: (...args: any[]) => {
      const flat = args.flat().map((v) => Number(v) || 0);
      return flat.reduce((a, b) => a + b, 0);
    },
    clamp: (x: any, min: any, max: any) => Math.min(Math.max(Number(x) || 0, Number(min) || 0), Number(max) || 0),
    pct: (part: any, total: any) => (Number(total) === 0 ? 0 : ((Number(part) || 0) / Number(total)) * 100),
    percentage: (part: any, total: any) => (Number(total) === 0 ? 0 : ((Number(part) || 0) / Number(total)) * 100),
    growth: (newVal: any, oldVal: any) => (Number(oldVal) === 0 ? 0 : (((Number(newVal) || 0) - Number(oldVal)) / Math.abs(Number(oldVal))) * 100),

    // 3. Logic & Error Handling
    if: (condition: any, trueVal: any, falseVal: any) => (condition ? trueVal : falseVal),
    iferror: (val: any, fallback: any) => {
      if (val === null || val === undefined || isNaN(val) || !isFinite(val) || (typeof val === 'string' && val.startsWith('ERR'))) {
        return fallback;
      }
      return val;
    },
    isnull: (x: any) => (x === null || x === undefined || isNaN(x) ? 1 : 0),
    isblank: (x: any) => (x === null || x === undefined || x === '' || isNaN(x) ? 1 : 0),
    nvl: (x: any, defaultVal: any) => (x === null || x === undefined || isNaN(x) || x === '' ? defaultVal : x),
    coalesce: (...args: any[]) => {
      for (const a of args) {
        if (a !== null && a !== undefined && !isNaN(a) && a !== '') return a;
      }
      return 0;
    },

    // 4. Date & Row Label Functions
    daysinmonth: (val?: any, yearOverride?: any) => {
      if (val === undefined || val === null || val === '') return 30;
      if (typeof val === 'number' && val >= 1 && val <= 12) {
        const y = Number(yearOverride) || 2024;
        return new Date(y, Math.floor(val), 0).getDate();
      }
      const parsed = parseDateOrLabel(val);
      if (yearOverride && parsed.month) {
        return new Date(Number(yearOverride), parsed.month, 0).getDate();
      }
      if (parsed.daysInMonth !== undefined) return parsed.daysInMonth;
      if (parsed.tenorDays !== undefined) return parsed.tenorDays;
      return 30;
    },
    daysofmonth: (val?: any, yearOverride?: any) => {
      return (customFunctions.daysinmonth as Function)(val, yearOverride);
    },
    days_in_month: (val?: any, yearOverride?: any) => {
      return (customFunctions.daysinmonth as Function)(val, yearOverride);
    },
    numdays: (val?: any, yearOverride?: any) => {
      return (customFunctions.daysinmonth as Function)(val, yearOverride);
    },
    day: (val: any) => {
      const parsed = parseDateOrLabel(val);
      if (parsed.day !== undefined) return parsed.day;
      if (parsed.daysInMonth !== undefined) return parsed.daysInMonth;
      return 1;
    },
    month: (val: any) => {
      const parsed = parseDateOrLabel(val);
      return parsed.month || 1;
    },
    year: (val: any) => {
      const parsed = parseDateOrLabel(val);
      return parsed.year || new Date().getFullYear();
    },
    days: (d1: any, d2?: any) => {
      if (d2 === undefined || d2 === null || d2 === '') {
        const str = String(d1).trim();
        const parts = str.split(/\s+(?:to|-)\s+/i);
        if (parts.length === 2) {
          const t1 = Date.parse(parts[0]);
          const t2 = Date.parse(parts[1]);
          if (!isNaN(t1) && !isNaN(t2)) {
            return Math.abs(Math.round((t2 - t1) / (1000 * 60 * 60 * 24))) + 1;
          }
        }
        const parsed = parseDateOrLabel(d1);
        return parsed.daysInMonth || parsed.tenorDays || 0;
      }
      const t1 = Date.parse(String(d1));
      const t2 = Date.parse(String(d2));
      if (isNaN(t1) || isNaN(t2)) return 0;
      return Math.abs(Math.round((t1 - t2) / (1000 * 60 * 60 * 24)));
    },
    datediff: (d1: any, d2: any) => {
      return (customFunctions.days as Function)(d1, d2);
    },
    daysinyear: (val?: any) => {
      const parsed = parseDateOrLabel(val);
      const y = parsed.year || (Number(val) > 1900 ? Number(val) : new Date().getFullYear());
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return isLeap ? 366 : 365;
    },
    days_in_year: (val?: any) => {
      return (customFunctions.daysinyear as Function)(val);
    },
    isleapyear: (val?: any) => {
      const parsed = parseDateOrLabel(val);
      const y = parsed.year || (Number(val) > 1900 ? Number(val) : new Date().getFullYear());
      return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 1 : 0;
    },
    eomonth: (val: any, addMonths: any = 0) => {
      const parsed = parseDateOrLabel(val);
      const y = parsed.year || new Date().getFullYear();
      const m = (parsed.month || 1) + Number(addMonths || 0);
      return new Date(y, m, 0).getDate();
    },
  };

  for (const [name, fn] of Object.entries(customFunctions)) {
    parser.functions[name.toLowerCase()] = fn as any;
    parser.functions[name.toUpperCase()] = fn as any;
  }

  return parser;
}

export function parseDateOrLabel(val: any): { year?: number; month?: number; day?: number; daysInMonth?: number; tenorDays?: number } {
  if (val === null || val === undefined) return {};
  if (typeof val === 'number') {
    if (val >= 1 && val <= 12) {
      const m = Math.floor(val);
      const is31 = [1, 3, 5, 7, 8, 10, 12].includes(m);
      if (is31) return { month: m, daysInMonth: 31 };
      if (m === 2) return { month: m, daysInMonth: 28 };
      return { month: m, daysInMonth: 30 };
    }
    if (val > 1900 && val < 2100) {
      return { year: Math.floor(val), daysInMonth: 365 };
    }
  }

  const str = String(val).trim();
  if (!str) return {};

  const upper = str.toUpperCase();

  // Financial Tenors: O/N, 1D, 2W, 1M, 3M, 1Y
  if (upper === 'O/N' || upper === 'ON' || upper === 'OVERNIGHT') return { tenorDays: 1, daysInMonth: 1 };
  if (upper === 'T/N' || upper === 'TN') return { tenorDays: 2, daysInMonth: 2 };
  if (upper === 'S/N' || upper === 'SN' || upper === 'SPOT/NEXT') return { tenorDays: 3, daysInMonth: 3 };
  if (upper === 'SPOT') return { tenorDays: 0, daysInMonth: 0 };

  const tenorMatch = upper.match(/^(\d+(?:\.\d+)?)\s*([DWMY]|DAYS?|WEEKS?|WKS?|MONTHS?|MOS?|MTHS?|YEARS?|YRS?)$/);
  if (tenorMatch) {
    const num = parseFloat(tenorMatch[1]);
    const unit = tenorMatch[2];
    if (unit.startsWith('D')) return { tenorDays: num, daysInMonth: num };
    if (unit.startsWith('W')) return { tenorDays: num * 7, daysInMonth: num * 7 };
    if (unit.startsWith('M')) return { tenorDays: Math.round(num * 30.4375), daysInMonth: Math.round(num * 30.4375) };
    if (unit.startsWith('Y')) return { tenorDays: Math.round(num * 365.25), daysInMonth: Math.round(num * 365.25) };
  }

  // Tenor ranges: "O/N to 2W", "1M - 3M", "1M TO 6M"
  const tenorRangeParts = upper.split(/\s+(?:TO|-)\s+/);
  if (tenorRangeParts.length === 2) {
    const p1 = parseDateOrLabel(tenorRangeParts[0]);
    const p2 = parseDateOrLabel(tenorRangeParts[1]);
    if (p1.tenorDays !== undefined && p2.tenorDays !== undefined) {
      const diff = Math.abs(p2.tenorDays - p1.tenorDays);
      return { tenorDays: diff, daysInMonth: diff };
    }
  }

  // Month names
  const monthMap: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };

  const lower = str.toLowerCase();
  const yearMatch = str.match(/\b(19\d\d|20\d\d)\b/);
  const detectedYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  for (const [mName, mNum] of Object.entries(monthMap)) {
    const mReg = new RegExp(`\\b${mName}\\b`, 'i');
    if (mReg.test(lower)) {
      const y = detectedYear || 2024;
      const dInM = new Date(y, mNum, 0).getDate();
      return { month: mNum, year: detectedYear, daysInMonth: dInM };
    }
  }

  // Quarters: Q1, Q2, Q3, Q4
  const qMatch = upper.match(/\bQ([1-4])\b/);
  if (qMatch) {
    const q = parseInt(qMatch[1], 10);
    const qDays = [90, 91, 92, 92][q - 1];
    return { daysInMonth: qDays };
  }

  // ISO / standard date formats: "YYYY-MM" or "YYYY/MM"
  const ymMatch = str.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10);
    if (m >= 1 && m <= 12) {
      const dInM = new Date(y, m, 0).getDate();
      return { year: y, month: m, daysInMonth: dInM };
    }
  }

  // "MM-YYYY" or "MM/YYYY"
  const myMatch = str.match(/^(\d{1,2})[-/](\d{4})$/);
  if (myMatch) {
    const m = parseInt(myMatch[1], 10);
    const y = parseInt(myMatch[2], 10);
    if (m >= 1 && m <= 12) {
      const dInM = new Date(y, m, 0).getDate();
      return { year: y, month: m, daysInMonth: dInM };
    }
  }

  // Full dates: YYYY-MM-DD or MM/DD/YYYY or DD-MM-YYYY
  const parsedTs = Date.parse(str);
  if (!isNaN(parsedTs)) {
    const d = new Date(parsedTs);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const dInM = new Date(y, m, 0).getDate();
    return { year: y, month: m, day, daysInMonth: dInM };
  }

  return {};
}

export const globalFormulaParser = createConfiguredParser();

export function preprocessFormula(rawFormula: string): string {
  if (!rawFormula) return '';
  let f = rawFormula.trim();

  // Strip leading '='
  if (f.startsWith('=')) {
    f = f.substring(1).trim();
  }

  // Rewrite zero-argument DAYSINMONTH() or DAYSOFMONTH() to daysinmonth([Row])
  f = f.replace(/\bDAYSINMONTH\s*\(\s*\)/gi, 'daysinmonth([Row])');
  f = f.replace(/\bDAYS_IN_MONTH\s*\(\s*\)/gi, 'days_in_month([Row])');
  f = f.replace(/\bDAYSOFMONTH\s*\(\s*\)/gi, 'daysofmonth([Row])');
  f = f.replace(/\bNUMDAYS\s*\(\s*\)/gi, 'numdays([Row])');

  // Normalize supported function names
  const funcNames = [
    'ABS', 'SQRT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'CEIL', 'CEILING', 'FLOOR',
    'TRUNC', 'INT', 'SIGN', 'MOD', 'POWER', 'POW', 'EXP', 'LOG', 'LN', 'LOG10',
    'MIN', 'MAX', 'AVG', 'AVERAGE', 'SUM', 'CLAMP', 'PCT', 'PERCENTAGE', 'GROWTH',
    'IF', 'IFERROR', 'ISNULL', 'ISBLANK', 'NVL', 'COALESCE',
    'DAYSINMONTH', 'DAYSOFMONTH', 'DAYS_IN_MONTH', 'NUMDAYS',
    'DAY', 'MONTH', 'YEAR', 'DAYS', 'DATEDIFF', 'DAYSINYEAR', 'DAYS_IN_YEAR', 'ISLEAPYEAR', 'EOMONTH'
  ];

  for (const fn of funcNames) {
    const reg = new RegExp(`\\b${fn}\\s*\\(`, 'gi');
    f = f.replace(reg, `${fn.toLowerCase()}(`);
  }

  return f;
}

