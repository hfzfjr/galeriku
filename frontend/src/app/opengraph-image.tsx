import { ImageResponse } from "next/og";

/**
 * Gambar Open Graph landing (1200x630, PNG).
 * Catatan: Satori (next/og) tidak bisa membaca variabel CSS, jadi warna
 * ditulis literal di sini — nilainya menyalin token DESIGN.md:
 * paper #F6F0E4, ink #2A2420, ink-muted #6B6054, line #DDD2BC,
 * accent #A9502E, accent-soft #EBD3C4. Font sistem (tanpa fetch eksternal).
 */

export const alt = "Galeriku — simpan foto perjalananmu dan kirim satu link";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          backgroundColor: "#F6F0E4",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -70,
            left: -70,
            width: 220,
            height: 220,
            backgroundColor: "#A9502E",
            transform: "rotate(45deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 90,
            height: 90,
            backgroundColor: "#EBD3C4",
          }}
        />
        <div
          style={{
            display: "flex",
            border: "3px solid #DDD2BC",
            borderRadius: 24,
            padding: "56px 64px",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 104,
              fontWeight: 600,
              lineHeight: 1,
              color: "#2A2420",
            }}
          >
            Galeriku
          </div>
          <div
            style={{
              marginTop: 24,
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: 38,
              lineHeight: 1.3,
              color: "#6B6054",
            }}
          >
            Simpan foto perjalananmu. Kirim satu link ke teman.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
