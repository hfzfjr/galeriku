import { Injectable, Logger } from '@nestjs/common';

export interface PlaceResult {
  city: string;
  admin1: string;
  country: string;
}

type CityTuple = [
  lat: number,
  lng: number,
  city: string,
  admin1: string,
  country: string,
];

// Jarak maksimum (km) untuk mengaitkan koordinat ke kota terdekat.
// Bila lebih jauh dari radius ini (mis. di tengah samudra lepas), dianggap tidak dikenal -> null.
const MAX_DISTANCE_KM = 80;

@Injectable()
export class PlaceService {
  private readonly logger = new Logger(PlaceService.name);
  private dataset: CityTuple[] | null = null;

  /**
   * Pemuatan dataset kota sekali (lazy). Tidak membebani memori saat startup.
   */
  private ensureDatasetLoaded(): CityTuple[] {
    if (this.dataset) {
      return this.dataset;
    }

    // Dataset kota/kabupaten offline terkurasi (Indonesia lengkap + destinasi internasional utama)
    this.dataset = [
      // DKI Jakarta
      [-6.1754, 106.8272, 'Jakarta Pusat', 'DKI Jakarta', 'Indonesia'],
      [-6.2615, 106.8106, 'Jakarta Selatan', 'DKI Jakarta', 'Indonesia'],
      [-6.1683, 106.7589, 'Jakarta Barat', 'DKI Jakarta', 'Indonesia'],
      [-6.2250, 106.9004, 'Jakarta Timur', 'DKI Jakarta', 'Indonesia'],
      [-6.1384, 106.8640, 'Jakarta Utara', 'DKI Jakarta', 'Indonesia'],
      [-5.6122, 106.5621, 'Kepulauan Seribu', 'DKI Jakarta', 'Indonesia'],

      // Jawa Barat
      [-6.9175, 107.6191, 'Bandung', 'Jawa Barat', 'Indonesia'],
      [-6.9039, 107.5029, 'Bandung Barat', 'Jawa Barat', 'Indonesia'],
      [-6.5971, 106.8060, 'Bogor', 'Jawa Barat', 'Indonesia'],
      [-6.4025, 106.7942, 'Depok', 'Jawa Barat', 'Indonesia'],
      [-6.2383, 106.9756, 'Bekasi', 'Jawa Barat', 'Indonesia'],
      [-6.7320, 108.5523, 'Cirebon', 'Jawa Barat', 'Indonesia'],
      [-6.9277, 106.9300, 'Sukabumi', 'Jawa Barat', 'Indonesia'],
      [-7.3274, 108.2207, 'Tasikmalaya', 'Jawa Barat', 'Indonesia'],
      [-6.8723, 107.5427, 'Cimahi', 'Jawa Barat', 'Indonesia'],
      [-7.2278, 107.9087, 'Garut', 'Jawa Barat', 'Indonesia'],
      [-6.8174, 107.1427, 'Cianjur', 'Jawa Barat', 'Indonesia'],
      [-6.3073, 107.3077, 'Karawang', 'Jawa Barat', 'Indonesia'],
      [-6.5569, 107.4433, 'Purwakarta', 'Jawa Barat', 'Indonesia'],
      [-6.5716, 107.7587, 'Subang', 'Jawa Barat', 'Indonesia'],
      [-6.8586, 107.9266, 'Sumedang', 'Jawa Barat', 'Indonesia'],
      [-6.3264, 108.3200, 'Indramayu', 'Jawa Barat', 'Indonesia'],
      [-6.8361, 108.2274, 'Majalengka', 'Jawa Barat', 'Indonesia'],
      [-6.9765, 108.4831, 'Kuningan', 'Jawa Barat', 'Indonesia'],
      [-7.3274, 108.3533, 'Ciamis', 'Jawa Barat', 'Indonesia'],
      [-7.7011, 108.6504, 'Pangandaran', 'Jawa Barat', 'Indonesia'],
      [-7.3756, 108.5342, 'Banjar', 'Jawa Barat', 'Indonesia'],

      // Banten
      [-6.1104, 106.1640, 'Serang', 'Banten', 'Indonesia'],
      [-6.0023, 106.0125, 'Cilegon', 'Banten', 'Indonesia'],
      [-6.1783, 106.6319, 'Tangerang', 'Banten', 'Indonesia'],
      [-6.2888, 106.7179, 'Tangerang Selatan', 'Banten', 'Indonesia'],
      [-6.5387, 106.2483, 'Lebak', 'Banten', 'Indonesia'],
      [-6.3086, 106.1064, 'Pandeglang', 'Banten', 'Indonesia'],

      // Jawa Tengah
      [-6.9667, 110.4167, 'Semarang', 'Jawa Tengah', 'Indonesia'],
      [-7.5755, 110.8243, 'Surakarta', 'Jawa Tengah', 'Indonesia'],
      [-7.4706, 110.2178, 'Magelang', 'Jawa Tengah', 'Indonesia'],
      [-7.3305, 110.5084, 'Salatiga', 'Jawa Tengah', 'Indonesia'],
      [-6.8886, 109.6753, 'Pekalongan', 'Jawa Tengah', 'Indonesia'],
      [-6.8694, 109.1402, 'Tegal', 'Jawa Tengah', 'Indonesia'],
      [-7.4243, 109.2304, 'Banyumas', 'Jawa Tengah', 'Indonesia'],
      [-7.7032, 109.0159, 'Cilacap', 'Jawa Tengah', 'Indonesia'],
      [-6.8048, 110.8405, 'Kudus', 'Jawa Tengah', 'Indonesia'],
      [-6.5932, 110.6775, 'Jepara', 'Jawa Tengah', 'Indonesia'],
      [-7.7058, 110.6019, 'Klaten', 'Jawa Tengah', 'Indonesia'],
      [-7.5361, 110.5947, 'Boyolali', 'Jawa Tengah', 'Indonesia'],
      [-7.6833, 110.8333, 'Sukoharjo', 'Jawa Tengah', 'Indonesia'],
      [-7.5960, 110.9515, 'Karanganyar', 'Jawa Tengah', 'Indonesia'],
      [-7.8139, 110.9250, 'Wonogiri', 'Jawa Tengah', 'Indonesia'],
      [-7.4262, 111.0224, 'Sragen', 'Jawa Tengah', 'Indonesia'],
      [-7.0911, 110.9167, 'Grobogan', 'Jawa Tengah', 'Indonesia'],
      [-6.9686, 111.4172, 'Blora', 'Jawa Tengah', 'Indonesia'],
      [-6.7063, 111.3400, 'Rembang', 'Jawa Tengah', 'Indonesia'],
      [-6.7560, 111.0379, 'Pati', 'Jawa Tengah', 'Indonesia'],
      [-6.8946, 110.6385, 'Demak', 'Jawa Tengah', 'Indonesia'],
      [-6.9249, 110.2036, 'Kendal', 'Jawa Tengah', 'Indonesia'],
      [-6.9088, 109.7314, 'Batang', 'Jawa Tengah', 'Indonesia'],
      [-6.8906, 109.3808, 'Pemalang', 'Jawa Tengah', 'Indonesia'],
      [-6.8710, 109.0433, 'Brebes', 'Jawa Tengah', 'Indonesia'],
      [-7.3900, 109.3638, 'Purbalingga', 'Jawa Tengah', 'Indonesia'],
      [-7.3986, 109.6967, 'Banjarnegara', 'Jawa Tengah', 'Indonesia'],
      [-7.6686, 109.6519, 'Kebumen', 'Jawa Tengah', 'Indonesia'],
      [-7.7144, 110.0094, 'Purworejo', 'Jawa Tengah', 'Indonesia'],
      [-7.3619, 109.9000, 'Wonosobo', 'Jawa Tengah', 'Indonesia'],
      [-7.3167, 110.1667, 'Temanggung', 'Jawa Tengah', 'Indonesia'],

      // DI Yogyakarta
      [-7.7956, 110.3695, 'Yogyakarta', 'DI Yogyakarta', 'Indonesia'],
      [-7.7167, 110.3556, 'Sleman', 'DI Yogyakarta', 'Indonesia'],
      [-7.8920, 110.3289, 'Bantul', 'DI Yogyakarta', 'Indonesia'],
      [-7.9600, 110.6000, 'Gunungkidul', 'DI Yogyakarta', 'Indonesia'],
      [-7.8286, 110.1581, 'Kulon Progo', 'DI Yogyakarta', 'Indonesia'],

      // Jawa Timur
      [-7.2575, 112.7521, 'Surabaya', 'Jawa Timur', 'Indonesia'],
      [-7.9797, 112.6304, 'Malang', 'Jawa Timur', 'Indonesia'],
      [-7.8712, 112.5270, 'Batu', 'Jawa Timur', 'Indonesia'],
      [-7.8167, 112.0167, 'Kediri', 'Jawa Timur', 'Indonesia'],
      [-8.0983, 112.1681, 'Blitar', 'Jawa Timur', 'Indonesia'],
      [-7.6298, 111.5239, 'Madiun', 'Jawa Timur', 'Indonesia'],
      [-7.7543, 113.2159, 'Probolinggo', 'Jawa Timur', 'Indonesia'],
      [-7.6453, 112.9075, 'Pasuruan', 'Jawa Timur', 'Indonesia'],
      [-7.4726, 112.4381, 'Mojokerto', 'Jawa Timur', 'Indonesia'],
      [-8.2192, 114.3691, 'Banyuwangi', 'Jawa Timur', 'Indonesia'],
      [-8.1724, 113.7007, 'Jember', 'Jawa Timur', 'Indonesia'],
      [-7.4478, 112.7183, 'Sidoarjo', 'Jawa Timur', 'Indonesia'],
      [-7.1566, 112.6555, 'Gresik', 'Jawa Timur', 'Indonesia'],
      [-7.1198, 112.4137, 'Lamongan', 'Jawa Timur', 'Indonesia'],
      [-6.8976, 112.0649, 'Tuban', 'Jawa Timur', 'Indonesia'],
      [-7.1500, 111.8819, 'Bojonegoro', 'Jawa Timur', 'Indonesia'],
      [-7.4042, 111.4458, 'Ngawi', 'Jawa Timur', 'Indonesia'],
      [-7.6536, 111.3281, 'Magetan', 'Jawa Timur', 'Indonesia'],
      [-7.8686, 111.4628, 'Ponorogo', 'Jawa Timur', 'Indonesia'],
      [-8.2064, 111.0928, 'Pacitan', 'Jawa Timur', 'Indonesia'],
      [-8.0500, 111.7167, 'Trenggalek', 'Jawa Timur', 'Indonesia'],
      [-8.0667, 111.9000, 'Tulungagung', 'Jawa Timur', 'Indonesia'],
      [-7.6050, 111.9036, 'Nganjuk', 'Jawa Timur', 'Indonesia'],
      [-7.5461, 112.2331, 'Jombang', 'Jawa Timur', 'Indonesia'],
      [-8.1333, 113.2222, 'Lumajang', 'Jawa Timur', 'Indonesia'],
      [-7.9139, 113.8211, 'Bondowoso', 'Jawa Timur', 'Indonesia'],
      [-7.7064, 114.0097, 'Situbondo', 'Jawa Timur', 'Indonesia'],
      [-7.0456, 112.7428, 'Bangkalan', 'Jawa Timur', 'Indonesia'],
      [-7.1869, 113.2433, 'Sampang', 'Jawa Timur', 'Indonesia'],
      [-7.1594, 113.4736, 'Pamekasan', 'Jawa Timur', 'Indonesia'],
      [-7.0167, 113.8667, 'Sumenep', 'Jawa Timur', 'Indonesia'],

      // Bali
      [-8.6705, 115.2126, 'Denpasar', 'Bali', 'Indonesia'],
      [-8.5833, 115.1833, 'Badung', 'Bali', 'Indonesia'],
      [-8.5375, 115.3242, 'Gianyar', 'Bali', 'Indonesia'],
      [-8.5411, 115.1244, 'Tabanan', 'Bali', 'Indonesia'],
      [-8.1120, 115.0882, 'Buleleng', 'Bali', 'Indonesia'],
      [-8.4489, 115.6117, 'Karangasem', 'Bali', 'Indonesia'],
      [-8.5367, 115.4050, 'Klungkung', 'Bali', 'Indonesia'],
      [-8.4542, 115.3550, 'Bangli', 'Bali', 'Indonesia'],
      [-8.3589, 114.6283, 'Jembrana', 'Bali', 'Indonesia'],

      // Nusa Tenggara Barat & Timur
      [-8.5833, 116.1167, 'Mataram', 'Nusa Tenggara Barat', 'Indonesia'],
      [-8.4608, 118.7275, 'Bima', 'Nusa Tenggara Barat', 'Indonesia'],
      [-8.6833, 116.2833, 'Lombok Tengah', 'Nusa Tenggara Barat', 'Indonesia'],
      [-8.6500, 116.5333, 'Lombok Timur', 'Nusa Tenggara Barat', 'Indonesia'],
      [-8.5000, 117.4333, 'Sumbawa', 'Nusa Tenggara Barat', 'Indonesia'],
      [-8.4964, 119.8877, 'Labuan Bajo', 'Nusa Tenggara Timur', 'Indonesia'],
      [-10.1772, 123.6070, 'Kupang', 'Nusa Tenggara Timur', 'Indonesia'],
      [-8.8431, 121.6622, 'Ende', 'Nusa Tenggara Timur', 'Indonesia'],
      [-8.6194, 122.2131, 'Maumere', 'Nusa Tenggara Timur', 'Indonesia'],

      // Sumatera
      [3.5952, 98.6722, 'Medan', 'Sumatera Utara', 'Indonesia'],
      [3.6000, 98.4833, 'Binjai', 'Sumatera Utara', 'Indonesia'],
      [2.9597, 99.0686, 'Pematangsiantar', 'Sumatera Utara', 'Indonesia'],
      [2.5833, 99.1667, 'Toba', 'Sumatera Utara', 'Indonesia'],
      [1.7425, 98.7842, 'Sibolga', 'Sumatera Utara', 'Indonesia'],
      [5.5483, 95.3238, 'Banda Aceh', 'Aceh', 'Indonesia'],
      [5.8928, 95.3250, 'Sabang', 'Aceh', 'Indonesia'],
      [5.1804, 97.1408, 'Lhokseumawe', 'Aceh', 'Indonesia'],
      [-0.9471, 100.4172, 'Padang', 'Sumatera Barat', 'Indonesia'],
      [-0.3056, 100.3692, 'Bukittinggi', 'Sumatera Barat', 'Indonesia'],
      [-0.2247, 100.6308, 'Payakumbuh', 'Sumatera Barat', 'Indonesia'],
      [0.5071, 101.4478, 'Pekanbaru', 'Riau', 'Indonesia'],
      [1.6667, 101.4500, 'Dumai', 'Riau', 'Indonesia'],
      [1.1301, 104.0529, 'Batam', 'Kepulauan Riau', 'Indonesia'],
      [0.9167, 104.4500, 'Tanjungpinang', 'Kepulauan Riau', 'Indonesia'],
      [-1.6101, 103.6131, 'Jambi', 'Jambi', 'Indonesia'],
      [-2.0592, 101.3956, 'Kerinci', 'Jambi', 'Indonesia'],
      [-2.9909, 104.7565, 'Palembang', 'Sumatera Selatan', 'Indonesia'],
      [-3.4333, 104.2333, 'Prabumulih', 'Sumatera Selatan', 'Indonesia'],
      [-3.2975, 102.9039, 'Lubuklinggau', 'Sumatera Selatan', 'Indonesia'],
      [-3.8000, 102.2667, 'Bengkulu', 'Bengkulu', 'Indonesia'],
      [-5.4500, 105.2667, 'Bandar Lampung', 'Lampung', 'Indonesia'],
      [-2.1333, 106.1167, 'Pangkalpinang', 'Kepulauan Bangka Belitung', 'Indonesia'],
      [-2.7333, 107.6333, 'Belitung', 'Kepulauan Bangka Belitung', 'Indonesia'],

      // Kalimantan
      [-0.0263, 109.3425, 'Pontianak', 'Kalimantan Barat', 'Indonesia'],
      [0.9078, 108.9867, 'Singkawang', 'Kalimantan Barat', 'Indonesia'],
      [-2.2078, 113.9164, 'Palangka Raya', 'Kalimantan Tengah', 'Indonesia'],
      [-3.3194, 114.5908, 'Banjarmasin', 'Kalimantan Selatan', 'Indonesia'],
      [-3.4411, 114.8317, 'Banjarbaru', 'Kalimantan Selatan', 'Indonesia'],
      [-0.5016, 117.1265, 'Samarinda', 'Kalimantan Timur', 'Indonesia'],
      [-1.2379, 116.8529, 'Balikpapan', 'Kalimantan Timur', 'Indonesia'],
      [0.1333, 117.5000, 'Bontang', 'Kalimantan Timur', 'Indonesia'],
      [-0.9500, 116.7000, 'Nusantara (IKN)', 'Kalimantan Timur', 'Indonesia'],
      [3.3000, 117.6333, 'Tarakan', 'Kalimantan Utara', 'Indonesia'],

      // Sulawesi
      [-5.1477, 119.4327, 'Makassar', 'Sulawesi Selatan', 'Indonesia'],
      [-4.0167, 119.6333, 'Parepare', 'Sulawesi Selatan', 'Indonesia'],
      [-2.9944, 120.1972, 'Palopo', 'Sulawesi Selatan', 'Indonesia'],
      [-3.1000, 119.8667, 'Toraja', 'Sulawesi Selatan', 'Indonesia'],
      [1.4748, 124.8421, 'Manado', 'Sulawesi Utara', 'Indonesia'],
      [1.4439, 125.1889, 'Bitung', 'Sulawesi Utara', 'Indonesia'],
      [1.3283, 124.8406, 'Tomohon', 'Sulawesi Utara', 'Indonesia'],
      [-0.9000, 119.8667, 'Palu', 'Sulawesi Tengah', 'Indonesia'],
      [-3.9985, 122.5126, 'Kendari', 'Sulawesi Tenggara', 'Indonesia'],
      [-5.4667, 122.6000, 'Baubau', 'Sulawesi Tenggara', 'Indonesia'],
      [0.5435, 123.0568, 'Gorontalo', 'Gorontalo', 'Indonesia'],
      [-2.6736, 118.8872, 'Mamuju', 'Sulawesi Barat', 'Indonesia'],

      // Maluku & Papua
      [-3.6954, 128.1814, 'Ambon', 'Maluku', 'Indonesia'],
      [0.7833, 127.3667, 'Ternate', 'Maluku Utara', 'Indonesia'],
      [-2.5337, 140.7181, 'Jayapura', 'Papua', 'Indonesia'],
      [-4.5469, 136.8836, 'Timika', 'Papua Tengah', 'Indonesia'],
      [-0.8756, 131.2558, 'Sorong', 'Papua Barat Daya', 'Indonesia'],
      [-0.8614, 134.0620, 'Manokwari', 'Papua Barat', 'Indonesia'],
      [-8.4932, 140.4014, 'Merauke', 'Papua Selatan', 'Indonesia'],

      // Destinasi Internasional Populer
      [1.3521, 103.8198, 'Singapura', 'Singapura', 'Singapura'],
      [3.1390, 101.6869, 'Kuala Lumpur', 'Wilayah Persekutuan', 'Malaysia'],
      [13.7563, 100.5018, 'Bangkok', 'Bangkok', 'Thailand'],
      [35.6762, 139.6503, 'Tokyo', 'Tokyo', 'Jepang'],
      [34.6937, 135.5023, 'Osaka', 'Osaka', 'Jepang'],
      [35.0116, 135.7681, 'Kyoto', 'Kyoto', 'Jepang'],
      [37.5665, 126.9780, 'Seoul', 'Seoul', 'Korea Selatan'],
      [21.3891, 39.8579, 'Mekkah', 'Makkah', 'Arab Saudi'],
      [24.5247, 39.5692, 'Madinah', 'Al Madinah', 'Arab Saudi'],
      [25.2048, 55.2708, 'Dubai', 'Dubai', 'Uni Emirat Arab'],
      [51.5074, -0.1278, 'London', 'Inggris', 'Inggris'],
      [48.8566, 2.3522, 'Paris', 'Île-de-France', 'Prancis'],
      [52.3676, 4.9041, 'Amsterdam', 'North Holland', 'Belanda'],
      [40.7128, -74.0060, 'New York', 'New York', 'Amerika Serikat'],
      [-33.8688, 151.2093, 'Sydney', 'New South Wales', 'Australia'],
      [-37.8136, 144.9631, 'Melbourne', 'Victoria', 'Australia'],
    ];

    this.logger.log(
      `Dataset tempat offline dimuat (${this.dataset.length} kota).`,
    );
    return this.dataset;
  }

  /**
   * Menghitung jarak Haversine (km) antara dua koordinat geografis.
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radius bumi dalam km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Menyelesaikan nama kota, provinsi/negara bagian, dan negara dari koordinat GPS secara offline.
   * Tidak ada panggilan jaringan keluar.
   *
   * Bila koordinat di laut lepas atau tak dikenal (> MAX_DISTANCE_KM), mengembalikan null tanpa error.
   */
  resolve(
    lat: number | null | undefined,
    lng: number | null | undefined,
  ): PlaceResult | null {
    if (
      lat == null ||
      lng == null ||
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    const cities = this.ensureDatasetLoaded();
    let closestCity: CityTuple | null = null;
    let minDistance = Infinity;

    for (const city of cities) {
      const d = this.haversineDistance(lat, lng, city[0], city[1]);
      if (d < minDistance) {
        minDistance = d;
        closestCity = city;
      }
    }

    if (!closestCity || minDistance > MAX_DISTANCE_KM) {
      return null;
    }

    return {
      city: closestCity[2],
      admin1: closestCity[3],
      country: closestCity[4],
    };
  }
}
