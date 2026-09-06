# Information Architecture: SSH Tunnel Manager

Desktop app (Electron, single window) untuk membuka `ssh -L` ke container Docker di host remote,
atau ke service Render lewat SSH gateway-nya. Satu pengguna di mesinnya sendiri, tanpa routing URL.

Dokumen ini menyusul aplikasi yang sudah jalan, jadi isinya sebagian perbaikan struktur —
bukan rancangan dari nol.

## Keputusan struktural

| Pertanyaan | Jawaban |
|---|---|
| Apa yang paling sering dicari user? | (1) **Port lokal** tunnel yang aktif — angka yang ditempel ke TablePlus/mongosh; (2) target ini tersambung atau tidak; (3) kalau gagal, kenapa |
| Kedalaman navigasi maksimal | 1 level. Semua kerja di satu layar |
| Yang bertambah seiring waktu | Daftar target hasil scan dan daftar koneksi terakhir. Keduanya pendek (belasan), jadi cukup search — tidak perlu paginasi |
| Tipe user berbeda? | Tidak ada |
| Layar tempat 80% waktu | Daftar target + panel detail |

Tiga temuan yang mengubah bentuk layar:

1. **Port lokal adalah keluaran utama aplikasi ini, tapi dulu paling tidak terlihat.** Dia hanya
   muncul sebagai teks kecil `localhost:10000 → 27017` di dalam baris, dan hanya setelah tunnel
   hidup. Padahal itu satu-satunya angka yang dibawa user keluar dari app. Sekarang dia jadi
   numeral utama baris, sejajar antar-baris, dengan tombol salin.
2. **Form koneksi memakan blok atas permanen padahal dipakai sekali per sesi.** Setelah scan
   berhasil, identitas koneksi cukup diringkas jadi satu baris (`root@192.168.1.100`); detailnya
   dilipat dan bisa dibuka lagi saat perlu ganti host.
3. **Error dilempar ke `alert()`.** Dialog yang memblokir, teksnya hilang begitu ditutup, dan tidak
   menempel ke baris yang gagal. Padahal pesan SSH (`Permission denied (publickey)`) justru
   informasi paling berharga saat gagal. Sekarang error menempel di target-nya dan bertahan.

## Site Map

- **Workspace** (selalu terlihat)
  - Context bar — mode, identitas koneksi, ringkasan tunnel aktif, aksi global
  - Connection panel — detail SSH / API key, host dari `~/.ssh/config`, koneksi terakhir
    (terlipat setelah scan berhasil)
  - Target list — hasil scan, dikelompokkan per state
  - Detail panel — target terpilih: peta port, perintah SSH, error, gateway (mode Render)

## Navigation Model

- **Primary**: mode **SSH / Docker** ↔ **Render**. Ini scope tertinggi: dia menentukan dari mana
  daftar target datang, ke mana SSH menyambung, dan field koneksi mana yang relevan. Karena itu
  posisinya paling kiri-atas dan mengubah warna aksen seluruh chrome — persis seperti
  staging/production di aplikasi port-forwarder sebelahnya.
- **Secondary**: search di atas daftar. Sengaja **tanpa** filter state: daftarnya pendek dan
  pengelompokan sudah menaikkan yang tersambung ke atas, jadi tombol filter "Aktif" hanya akan
  mengulang pekerjaan yang sudah dilakukan grup.
- **Utility**: tombol scan, hentikan semua, tema terang/gelap, dan chevron untuk membuka detail
  koneksi.

## Content Hierarchy

### Target list (per baris)
1. **Status lamp + port lokal** — digabung jadi satu blok kiri yang sejajar antar-baris. Kalau
   tunnel belum jalan, slot ini diisi input port remote, jadi kolomnya tidak pernah kosong dan
   posisi angka tidak melompat saat tunnel menyala.
2. **Port remote** — kecil, redup, di kanan panah.
3. **Nama target** + ikon jenis service.
4. **Konteks**: image/tipe, region/plan, status container. Satu baris kecil.
5. **Error terakhir**, kalau ada — menggantikan baris konteks, warna error.
6. **Aksi**: sambungkan / putuskan.

### Detail panel
1. **Peta port ukuran besar + tombol salin `localhost:<port>`** — alasan utama panel ini ada.
2. Identitas target: nama, image, host privat (Render), status.
3. **Gateway "via"** (khusus Render) beserta penjelasan kenapa perlu.
4. Error terakhir, utuh, bisa diseleksi.

## User Flows

### Menyambung ke database di server (mode SSH)
1. Buka app → panel koneksi terbuka kalau host belum pernah diisi, terlipat kalau sudah
2. Isi host/user/key, atau klik salah satu koneksi terakhir
3. **Scan** → daftar container muncul; panel koneksi melipat sendiri
4. Ketik port remote di baris yang dituju (sudah terisi tebakan) → **Sambungkan**
   - Berhasil → baris pindah ke grup Aktif, port lokal tampil besar, siap disalin
   - Gagal → error menempel di baris itu, daftar tetap utuh
5. Salin `localhost:<port>` ke client database

### Menyambung ke service Render
1. Ganti mode ke Render → aksen chrome berubah, field berubah jadi API key
2. Scan → daftar service; gateway "via" dipilih otomatis (web service, lalu worker)
3. Pilih target → panel detail menjelaskan kenapa tunnel lewat service lain
4. Sambungkan seperti biasa

### Tunnel putus sendiri
1. SSH mati (jaringan, host restart) → main process memberi tahu renderer
2. Baris kembali ke grup tidak aktif, statusnya merah dengan alasan dari stderr
3. User menyambungkan ulang — tidak ada baris yang berbohong "aktif" padahal sudah mati

## Naming Conventions

| Konsep | Label di UI | Alasan |
|---|---|---|
| Sumber target | **Mode** — SSH / Docker, Render | Sudah dipakai di kode |
| Satu hal yang bisa di-tunnel | **Target** | Netral untuk container maupun service |
| Port di mesin user | **local** | Yang ditempel ke client |
| Port di ujung sana | **remote** | Beda dari port-forwarder yang memakai "pod": di sini ujungnya container atau host privat, bukan pod |
| Service yang menampung sesi SSH | **Gateway** | Sebelumnya "via", terlalu samar berdiri sendiri |
| Membuka tunnel | **Sambungkan** | Sebelumnya "Forward"; kata bendanya sudah "tunnel", kata kerjanya harus konsisten |
| Menutup tunnel | **Putuskan** | Pasangan dari Sambungkan |
| Mengambil daftar target | **Scan** | Sudah dipakai user |

## Component Reuse Map

| Komponen | Dipakai di | Perbedaan perilaku |
|---|---|---|
| `ContextBar` | Workspace | Aksen berbeda per mode |
| `ConnectionPanel` | Workspace | Field SSH vs API key; terlipat setelah scan berhasil |
| `TargetRow` | Target list | Varian aktif / idle / error |
| `PortMap` | TargetRow, DetailPanel | `sm` di baris, `lg` di panel |
| `StatusLamp` | TargetRow, ContextBar | Rail di baris, titik di ringkasan |
| `DetailPanel` | Workspace | Blok gateway hanya di mode Render |

## Content Growth Plan

Daftar target diganti utuh tiap scan, jadi tidak menumpuk. Koneksi terakhir dibatasi 10 di main
process. Tidak ada log yang tumbuh — pesan yang disimpan hanya error terakhir per target.

## URL Strategy

Tidak berlaku. State yang bertahan antar sesi (mode, host/user/key, API key, tema, port yang
pernah berhasil) disimpan di `~/.tunnel_manager.json`; hasil scan, seleksi, dan search sengaja
tidak disimpan.
