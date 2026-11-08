export type PhotoDateGroup = {
  dateKey: string;
  displayDate: string;
  formattedTime: string;
};

/**
 * Menghitung kunci pengelompokan tanggal, judul tampilan, dan jam foto
 * berdasarkan capturedAt dan zona offset foto bila ada (RF-12).
 * Jika foto memiliki capturedTzOffsetMin, tanggal dan jam dihitung dalam
 * zona waktu saat foto diambil (bukan zona waktu browser pemirsa).
 */
export function getPhotoDateGroup(
  isoString: string,
  offsetMin?: number | null,
): PhotoDateGroup {
  const d = new Date(isoString);
  const timeMs = d.getTime();
  if (isNaN(timeMs)) {
    return {
      dateKey: "lainnya",
      displayDate: "Tanggal tidak diketahui",
      formattedTime: "-",
    };
  }

  // Jika offset zona foto tersedia (+420 untuk WIB, -300 untuk EST, dst.)
  if (typeof offsetMin === "number") {
    const localMs = timeMs + offsetMin * 60 * 1000;
    const utcDate = new Date(localMs);
    const year = utcDate.getUTCFullYear();
    const month = utcDate.getUTCMonth() + 1;
    const day = utcDate.getUTCDate();
    const hour = utcDate.getUTCHours().toString().padStart(2, "0");
    const minute = utcDate.getUTCMinutes().toString().padStart(2, "0");
    const dateKey = `${year}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;

    const dummyUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const displayDate = new Intl.DateTimeFormat("id-ID", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dummyUtc);

    return {
      dateKey,
      displayDate,
      formattedTime: `${hour}.${minute}`,
    };
  }

  // Tanpa offset zona: gunakan zona waktu lokal browser pemirsa
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours().toString().padStart(2, "0");
  const minute = d.getMinutes().toString().padStart(2, "0");
  const dateKey = `${year}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;

  const displayDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);

  return {
    dateKey,
    displayDate,
    formattedTime: `${hour}.${minute}`,
  };
}
