export type PhotoDateGroup = {
  dateKey: string;
  displayDate: string;
  formattedTime: string;
};

/**
 * Menghitung kunci pengelompokan tanggal, judul tampilan, dan jam foto/video
 * berdasarkan capturedAt secara konsisten sesuai waktu asli pengambilan berkas
 * tanpa pergeseran ganda zona waktu (tanpa penambahan +7 GMT dari browser).
 */
export function getPhotoDateGroup(
  isoString: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _offsetMin?: number | null,
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

  // Gunakan komponen waktu UTC dari ISO string yang merepresentasikan jam, menit,
  // dan tanggal aktual saat gambar/video diambil oleh kamera pengguna.
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours().toString().padStart(2, "0");
  const minute = d.getUTCMinutes().toString().padStart(2, "0");
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
