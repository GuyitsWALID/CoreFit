const ETHIOPIAN_EPOCH = 1724221;
const DISPLAY_TIME_ZONE = 'Africa/Addis_Ababa';
const ETHIOALL_CONVERT_URL = 'https://api.ethioall.com/convert/api';

const ETHIOPIAN_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

type GregorianDateParts = {
  year: number;
  month: number;
  day: number;
};

const addisDatePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const addisGregorianFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const getAddisDateParts = (date: Date): GregorianDateParts | null => {
  if (Number.isNaN(date.getTime())) return null;

  const parts = addisDatePartsFormatter.formatToParts(date).reduce<Record<string, number>>((acc, part) => {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      acc[part.type] = Number(part.value);
    }
    return acc;
  }, {});

  if (!parts.year || !parts.month || !parts.day) return null;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
};

const getGregorianDateParts = (value: string | Date): GregorianDateParts | null => {
  if (value instanceof Date) return getAddisDateParts(value);

  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return {
      year: Number(dateOnlyMatch[1]),
      month: Number(dateOnlyMatch[2]),
      day: Number(dateOnlyMatch[3]),
    };
  }

  return getAddisDateParts(new Date(trimmed));
};

const toGregorianJulianDay = ({ year: inputYear, month: inputMonth, day }: GregorianDateParts) => {
  let year = inputYear;
  let month = inputMonth;
  const adjustment = Math.floor((14 - month) / 12);

  year = year + 4800 - adjustment;
  month = month + 12 * adjustment - 3;

  return day
    + Math.floor((153 * month + 2) / 5)
    + 365 * year
    + Math.floor(year / 4)
    - Math.floor(year / 100)
    + Math.floor(year / 400)
    - 32045;
};

export type EthiopianDate = {
  year: number;
  month: number;
  day: number;
  monthName: string;
};

type EthioallEthiopianResponse = {
  type: 'toEthiopian';
  day: number;
  month: number;
  year: number;
  day_name?: {
    amharic?: string;
    english?: string;
  };
  month_name?: {
    amharic?: string;
    english?: string;
  };
};

export const toEthiopianDate = (value: string | Date): EthiopianDate | null => {
  const gregorianDate = getGregorianDateParts(value);
  if (!gregorianDate) return null;

  const julianDay = toGregorianJulianDay(gregorianDate);
  const elapsed = julianDay - ETHIOPIAN_EPOCH;
  const year = Math.floor((4 * elapsed + 1463) / 1461);
  const startOfYear = 365 * (year - 1) + Math.floor(year / 4);
  const dayOfYear = elapsed - startOfYear;
  const month = Math.floor(dayOfYear / 30) + 1;
  const day = dayOfYear - 30 * (month - 1) + 1;

  return {
    year,
    month,
    day,
    monthName: ETHIOPIAN_MONTHS[month - 1] ?? `Month ${month}`,
  };
};

export const formatEthiopianDate = (value: string | Date | null | undefined) => {
  if (!value) return '-';
  const ethiopianDate = toEthiopianDate(value);
  if (!ethiopianDate) return '-';

  return `${ethiopianDate.monthName} ${ethiopianDate.day}, ${ethiopianDate.year} E.C.`;
};

export const formatGregorianDate = (value: string | Date | null | undefined) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return addisGregorianFormatter.format(date);
};

export const toGregorianDateKey = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const parts = getGregorianDateParts(value instanceof Date ? value : String(value));
  if (!parts) return null;

  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
};

export const formatEthioallEthiopianDate = (value: EthioallEthiopianResponse | null | undefined) => {
  if (!value) return null;
  const monthName = value.month_name?.english || ETHIOPIAN_MONTHS[value.month - 1] || `Month ${value.month}`;
  return `${monthName} ${value.day}, ${value.year} E.C.`;
};

export const convertGregorianDatesWithEthioall = async (dateKeys: string[]) => {
  const uniqueDateKeys = Array.from(new Set(dateKeys.filter(Boolean)));
  if (uniqueDateKeys.length === 0) return {};

  const params = new URLSearchParams();
  uniqueDateKeys.forEach(dateKey => params.append('gc[]', dateKey));

  const response = await fetch(`${ETHIOALL_CONVERT_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Ethioall conversion failed with status ${response.status}`);
  }

  const payload = await response.json() as EthioallEthiopianResponse[];
  if (!Array.isArray(payload)) {
    throw new Error('Ethioall conversion returned an unexpected response.');
  }

  return uniqueDateKeys.reduce<Record<string, string>>((acc, dateKey, index) => {
    const formattedDate = formatEthioallEthiopianDate(payload[index]);
    if (formattedDate) acc[dateKey] = formattedDate;
    return acc;
  }, {});
};
