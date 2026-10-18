export const WEEKDAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_NAMES_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export interface FormattedEventDate {
  weekdayShort: string;
  weekdayFull: string;
  formattedDate: string;
  formattedFullDate: string;
  timeRange: string | null;
  displaySummary: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Parses eventDate string (which may be YYYY-MM-DD, YYYY-MM-DDTHH:mm, or YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm)
 * and returns localized readable strings.
 */
export function formatEventDateTime(eventDate?: string | null): FormattedEventDate {
  if (!eventDate) {
    return {
      weekdayShort: "",
      weekdayFull: "",
      formattedDate: "",
      formattedFullDate: "",
      timeRange: null,
      displaySummary: "",
    };
  }

  let startStr = eventDate;
  let endStr: string | null = null;
  if (eventDate.includes("/")) {
    const parts = eventDate.split("/");
    startStr = parts[0];
    endStr = parts[1];
  }

  const d = new Date(startStr);
  if (isNaN(d.getTime())) {
    return {
      weekdayShort: "",
      weekdayFull: "",
      formattedDate: eventDate,
      formattedFullDate: eventDate,
      timeRange: null,
      displaySummary: eventDate,
    };
  }

  const weekdayShort = WEEKDAY_NAMES_SHORT[d.getDay()] || "";
  const weekdayFull = WEEKDAY_NAMES_FULL[d.getDay()] || "";
  const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const formattedFullDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  let timeRange: string | null = null;
  if (startStr.includes("T")) {
    const startTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (endStr && endStr.includes("T")) {
      const endD = new Date(endStr);
      if (!isNaN(endD.getTime())) {
        const endTime = `${pad(endD.getHours())}:${pad(endD.getMinutes())}`;
        timeRange = `${startTime} – ${endTime}`;
      } else {
        timeRange = startTime;
      }
    } else {
      timeRange = startTime;
    }
  }

  const displaySummary = [
    weekdayShort && formattedDate ? `${weekdayShort}, ${formattedDate}` : formattedDate,
    timeRange,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    weekdayShort,
    weekdayFull,
    formattedDate,
    formattedFullDate,
    timeRange,
    displaySummary,
  };
}
