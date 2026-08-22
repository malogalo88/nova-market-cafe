import type { Part, Cat, CPU, GPU, MB, RAM, Storage, PSU, Case, Cooler, FanSet, OSPart, Monitor, Peripheral } from '../types'

// ─── Component database ────────────────────────────────────────────────────
// Sample catalog with approximate street prices (USD). Structured so real
// product/pricing feeds can replace this module later without UI changes.
// All performance numbers are PCForge relative estimates, not benchmarks.

export const CPUS: CPU[] = [
  { id: 'i3-12100f', cat: 'cpu', name: 'Intel Core i3-12100F', brand: 'Intel', price: 85, msrp: 122, rating: 4.7, year: 2022, socket: 'LGA1700', cores: 4, threads: 8, boost: 4.3, tdp: 58, gaming: 44, multi: 38, igpu: false },
  { id: 'i5-12400f', cat: 'cpu', name: 'Intel Core i5-12400F', brand: 'Intel', price: 125, msrp: 180, rating: 4.8, year: 2022, socket: 'LGA1700', cores: 6, threads: 12, boost: 4.4, tdp: 65, gaming: 58, multi: 60, igpu: false },
  { id: 'i5-13600k', cat: 'cpu', name: 'Intel Core i5-13600K', brand: 'Intel', price: 235, msrp: 320, rating: 4.7, year: 2022, socket: 'LGA1700', cores: 14, threads: 20, boost: 5.1, tdp: 125, gaming: 76, multi: 86, igpu: true },
  { id: 'i7-14700k', cat: 'cpu', name: 'Intel Core i7-14700K', brand: 'Intel', price: 330, msrp: 410, rating: 4.6, year: 2023, socket: 'LGA1700', cores: 20, threads: 28, boost: 5.6, tdp: 125, gaming: 86, multi: 95, igpu: true },
  { id: 'i9-14900k', cat: 'cpu', name: 'Intel Core i9-14900K', brand: 'Intel', price: 430, msrp: 590, rating: 4.5, year: 2023, socket: 'LGA1700', cores: 24, threads: 32, boost: 6.0, tdp: 125, gaming: 89, multi: 100, igpu: true },
  { id: 'r5-5600', cat: 'cpu', name: 'AMD Ryzen 5 5600', brand: 'AMD', price: 125, msrp: 199, rating: 4.8, year: 2022, socket: 'AM4', cores: 6, threads: 12, boost: 4.4, tdp: 65, gaming: 60, multi: 62, igpu: false },
  { id: 'r7-5700x3d', cat: 'cpu', name: 'AMD Ryzen 7 5700X3D', brand: 'AMD', price: 190, msrp: 250, rating: 4.9, year: 2024, socket: 'AM4', cores: 8, threads: 16, boost: 4.1, tdp: 105, gaming: 80, multi: 68, igpu: false },
  { id: 'r5-7600', cat: 'cpu', name: 'AMD Ryzen 5 7600', brand: 'AMD', price: 195, msrp: 229, rating: 4.8, year: 2023, socket: 'AM5', cores: 6, threads: 12, boost: 5.1, tdp: 65, gaming: 78, multi: 72, igpu: true },
  { id: 'r7-7800x3d', cat: 'cpu', name: 'AMD Ryzen 7 7800X3D', brand: 'AMD', price: 340, msrp: 399, rating: 4.9, year: 2023, socket: 'AM5', cores: 8, threads: 16, boost: 5.0, tdp: 120, gaming: 96, multi: 82, igpu: true },
  { id: 'r9-7900x', cat: 'cpu', name: 'AMD Ryzen 9 7900X', brand: 'AMD', price: 310, msrp: 429, rating: 4.6, year: 2022, socket: 'AM5', cores: 12, threads: 24, boost: 5.4, tdp: 170, gaming: 82, multi: 93, igpu: true },
  { id: 'r7-9800x3d', cat: 'cpu', name: 'AMD Ryzen 7 9800X3D', brand: 'AMD', price: 470, msrp: 479, rating: 4.9, year: 2024, socket: 'AM5', cores: 8, threads: 16, boost: 5.2, tdp: 120, gaming: 100, multi: 88, igpu: true },
]

export const GPUS: GPU[] = [
  { id: 'arc-a750', cat: 'gpu', name: 'Intel Arc A750', brand: 'Intel', price: 175, msrp: 289, rating: 4.4, year: 2022, vram: 8, tdp: 225, length: 267, perf: 42, connectors: '1× 8-pin', recPsu: 550 },
  { id: 'rx-6600', cat: 'gpu', name: 'AMD Radeon RX 6600', brand: 'AMD', price: 185, msrp: 229, rating: 4.7, year: 2021, vram: 8, tdp: 132, length: 240, perf: 40, connectors: '1× 8-pin', recPsu: 500 },
  { id: 'rtx-4060', cat: 'gpu', name: 'NVIDIA GeForce RTX 4060', brand: 'NVIDIA', price: 290, msrp: 299, rating: 4.7, year: 2023, vram: 8, tdp: 115, length: 240, perf: 48, connectors: '1× 8-pin', recPsu: 550 },
  { id: 'rx-7600', cat: 'gpu', name: 'AMD Radeon RX 7600', brand: 'AMD', price: 255, msrp: 269, rating: 4.6, year: 2023, vram: 8, tdp: 165, length: 200, perf: 50, connectors: '1× 8-pin', recPsu: 550 },
  { id: 'rtx-4060ti-16', cat: 'gpu', name: 'NVIDIA RTX 4060 Ti 16GB', brand: 'NVIDIA', price: 435, msrp: 499, rating: 4.4, year: 2023, vram: 16, tdp: 165, length: 240, perf: 57, connectors: '1× 8-pin (16-pin on some models)', recPsu: 600 },
  { id: 'rx-7700xt', cat: 'gpu', name: 'AMD Radeon RX 7700 XT', brand: 'AMD', price: 420, msrp: 449, rating: 4.6, year: 2023, vram: 12, tdp: 245, length: 267, perf: 66, connectors: '2× 8-pin', recPsu: 650 },
  { id: 'rtx-4070s', cat: 'gpu', name: 'NVIDIA RTX 4070 SUPER', brand: 'NVIDIA', price: 580, msrp: 599, rating: 4.8, year: 2024, vram: 12, tdp: 220, length: 267, perf: 74, connectors: '1× 16-pin adapter', recPsu: 650 },
  { id: 'rx-7900gre', cat: 'gpu', name: 'AMD Radeon RX 7900 GRE', brand: 'AMD', price: 540, msrp: 549, rating: 4.7, year: 2024, vram: 16, tdp: 260, length: 280, perf: 77, connectors: '2× 8-pin', recPsu: 700 },
  { id: 'rtx-5070', cat: 'gpu', name: 'NVIDIA GeForce RTX 5070', brand: 'NVIDIA', price: 549, msrp: 549, rating: 4.6, year: 2025, vram: 12, tdp: 250, length: 304, perf: 79, connectors: '1× 16-pin', recPsu: 650 },
  { id: 'rtx-4070tis', cat: 'gpu', name: 'NVIDIA RTX 4070 Ti SUPER', brand: 'NVIDIA', price: 780, msrp: 799, rating: 4.8, year: 2024, vram: 16, tdp: 285, length: 310, perf: 87, connectors: '1× 16-pin adapter', recPsu: 700 },
  { id: 'rx-9070xt', cat: 'gpu', name: 'AMD Radeon RX 9070 XT', brand: 'AMD', price: 599, msrp: 599, rating: 4.7, year: 2025, vram: 16, tdp: 304, length: 320, perf: 88, connectors: '2× 8-pin', recPsu: 700 },
  { id: 'rx-7900xtx', cat: 'gpu', name: 'AMD Radeon RX 7900 XTX', brand: 'AMD', price: 880, msrp: 999, rating: 4.8, year: 2022, vram: 24, tdp: 355, length: 287, perf: 93, connectors: '2× 8-pin + 1× 6-pin', recPsu: 800 },
  { id: 'rtx-4080s', cat: 'gpu', name: 'NVIDIA RTX 4080 SUPER', brand: 'NVIDIA', price: 980, msrp: 999, rating: 4.8, year: 2024, vram: 16, tdp: 320, length: 310, perf: 95, connectors: '1× 16-pin adapter', recPsu: 750 },
  { id: 'rtx-5080', cat: 'gpu', name: 'NVIDIA GeForce RTX 5080', brand: 'NVIDIA', price: 999, msrp: 999, rating: 4.7, year: 2025, vram: 16, tdp: 360, length: 304, perf: 98, connectors: '1× 16-pin', recPsu: 850 },
  { id: 'rtx-4090', cat: 'gpu', name: 'NVIDIA GeForce RTX 4090', brand: 'NVIDIA', price: 1599, msrp: 1599, rating: 4.9, year: 2022, vram: 24, tdp: 450, length: 336, perf: 100, connectors: '1× 16-pin', recPsu: 1000 },
]

export const MBS: MB[] = [
  { id: 'h610m', cat: 'mb', name: 'Gigabyte H610M H', brand: 'Gigabyte', price: 70, msrp: 80, rating: 4.5, socket: 'LGA1700', form: 'Micro-ATX', ramType: 'DDR4', maxRam: 64, m2: 1, sata: 4, wifi: false, biosNote: 'Early BIOS versions may need an update for 13th/14th Gen Intel CPUs.' },
  { id: 'b660m', cat: 'mb', name: 'MSI PRO B660M-A WIFI', brand: 'MSI', price: 95, msrp: 140, rating: 4.6, socket: 'LGA1700', form: 'Micro-ATX', ramType: 'DDR4', maxRam: 128, m2: 2, sata: 4, wifi: true, biosNote: 'May require a BIOS update for 13th/14th Gen Intel CPUs.' },
  { id: 'b760m', cat: 'mb', name: 'ASRock B760M Pro RS', brand: 'ASRock', price: 105, msrp: 110, rating: 4.5, socket: 'LGA1700', form: 'Micro-ATX', ramType: 'DDR5', maxRam: 128, m2: 2, sata: 4, wifi: false },
  { id: 'z790', cat: 'mb', name: 'MSI MPG Z790 EDGE WIFI', brand: 'MSI', price: 280, msrp: 300, rating: 4.7, socket: 'LGA1700', form: 'ATX', ramType: 'DDR5', maxRam: 192, m2: 4, sata: 6, wifi: true },
  { id: 'b550m', cat: 'mb', name: 'MSI B550M PRO-VDH WIFI', brand: 'MSI', price: 75, msrp: 90, rating: 4.6, socket: 'AM4', form: 'Micro-ATX', ramType: 'DDR4', maxRam: 128, m2: 1, sata: 4, wifi: true },
  { id: 'b550', cat: 'mb', name: 'ASUS TUF Gaming B550-PLUS', brand: 'ASUS', price: 110, msrp: 140, rating: 4.7, socket: 'AM4', form: 'ATX', ramType: 'DDR4', maxRam: 128, m2: 2, sata: 6, wifi: false },
  { id: 'b650m', cat: 'mb', name: 'Gigabyte B650M DS3H', brand: 'Gigabyte', price: 115, msrp: 130, rating: 4.6, socket: 'AM5', form: 'Micro-ATX', ramType: 'DDR5', maxRam: 192, m2: 2, sata: 4, wifi: false, biosNote: 'Very early BIOS versions may need an update for Ryzen 9000 CPUs.' },
  { id: 'b650', cat: 'mb', name: 'MSI MAG B650 Tomahawk WIFI', brand: 'MSI', price: 180, msrp: 220, rating: 4.8, socket: 'AM5', form: 'ATX', ramType: 'DDR5', maxRam: 192, m2: 3, sata: 6, wifi: true },
  { id: 'b650i', cat: 'mb', name: 'MSI MPG B650I EDGE WIFI', brand: 'MSI', price: 210, msrp: 230, rating: 4.6, socket: 'AM5', form: 'Mini-ITX', ramType: 'DDR5', maxRam: 96, m2: 2, sata: 2, wifi: true },
  { id: 'x670e', cat: 'mb', name: 'ASUS ROG STRIX X670E-E GAMING', brand: 'ASUS', price: 400, msrp: 470, rating: 4.7, socket: 'AM5', form: 'ATX', ramType: 'DDR5', maxRam: 192, m2: 4, sata: 8, wifi: true },
]

export const RAMS: RAM[] = [
  { id: 'vengeance-16-d4', cat: 'ram', name: 'Corsair Vengeance LPX 16GB (2×8) DDR4-3200', brand: 'Corsair', price: 38, msrp: 45, rating: 4.8, type: 'DDR4', gb: 16, sticks: 2, mhz: 3200, rgb: false },
  { id: 'fury-32-d4', cat: 'ram', name: 'Kingston FURY Beast 32GB (2×16) DDR4-3600', brand: 'Kingston', price: 58, msrp: 70, rating: 4.7, type: 'DDR4', gb: 32, sticks: 2, mhz: 3600, rgb: false },
  { id: 'ripjaws-32-d4', cat: 'ram', name: 'G.Skill Ripjaws V 32GB (2×16) DDR4-3600', brand: 'G.Skill', price: 62, msrp: 75, rating: 4.8, type: 'DDR4', gb: 32, sticks: 2, mhz: 3600, rgb: false },
  { id: 'delta-16-d5', cat: 'ram', name: 'T-Force Delta RGB 16GB (2×8) DDR5-5600', brand: 'TeamGroup', price: 52, msrp: 60, rating: 4.6, type: 'DDR5', gb: 16, sticks: 2, mhz: 5600, rgb: true },
  { id: 'vengeance-32-d5', cat: 'ram', name: 'Corsair Vengeance 32GB (2×16) DDR5-6000 CL30', brand: 'Corsair', price: 95, msrp: 115, rating: 4.8, type: 'DDR5', gb: 32, sticks: 2, mhz: 6000, rgb: false },
  { id: 'trident-32-d5', cat: 'ram', name: 'G.Skill Trident Z5 RGB 32GB (2×16) DDR5-6000', brand: 'G.Skill', price: 112, msrp: 130, rating: 4.8, type: 'DDR5', gb: 32, sticks: 2, mhz: 6000, rgb: true },
  { id: 'fury-64-d5', cat: 'ram', name: 'Kingston FURY Beast 64GB (2×32) DDR5-5600', brand: 'Kingston', price: 175, msrp: 200, rating: 4.7, type: 'DDR5', gb: 64, sticks: 2, mhz: 5600, rgb: false },
]

export const STORAGES: Storage[] = [
  { id: 'p3-500', cat: 'storage', name: 'Crucial P3 500GB NVMe', brand: 'Crucial', price: 35, msrp: 40, rating: 4.6, kind: 'NVMe SSD', iface: 'PCIe 3.0', gb: 500, read: 3500 },
  { id: 'sn580-1tb', cat: 'storage', name: 'WD Blue SN580 1TB NVMe', brand: 'Western Digital', price: 58, msrp: 70, rating: 4.7, kind: 'NVMe SSD', iface: 'PCIe 4.0', gb: 1000, read: 4155 },
  { id: 'nv2-2tb', cat: 'storage', name: 'Kingston NV2 2TB NVMe', brand: 'Kingston', price: 82, msrp: 100, rating: 4.5, kind: 'NVMe SSD', iface: 'PCIe 4.0', gb: 2000, read: 3500 },
  { id: '990pro-1tb', cat: 'storage', name: 'Samsung 990 PRO 1TB NVMe', brand: 'Samsung', price: 98, msrp: 129, rating: 4.9, kind: 'NVMe SSD', iface: 'PCIe 4.0', gb: 1000, read: 7450 },
  { id: '990pro-2tb', cat: 'storage', name: 'Samsung 990 PRO 2TB NVMe', brand: 'Samsung', price: 158, msrp: 189, rating: 4.9, kind: 'NVMe SSD', iface: 'PCIe 4.0', gb: 2000, read: 7450 },
  { id: 'mx500-1tb', cat: 'storage', name: 'Crucial MX500 1TB SATA SSD', brand: 'Crucial', price: 58, msrp: 70, rating: 4.8, kind: 'SATA SSD', iface: 'SATA', gb: 1000, read: 560 },
  { id: 'barracuda-2tb', cat: 'storage', name: 'Seagate Barracuda 2TB HDD', brand: 'Seagate', price: 50, msrp: 60, rating: 4.6, kind: 'HDD', iface: 'SATA', gb: 2000, read: 220 },
]

export const PSUS: PSU[] = [
  { id: 'evga-600b', cat: 'psu', name: 'EVGA 600 BR 600W 80+ Bronze', brand: 'EVGA', price: 45, msrp: 50, rating: 4.5, watts: 600, cert: '80+ Bronze', modular: false },
  { id: 'cv650', cat: 'psu', name: 'Corsair CV650 650W 80+ Bronze', brand: 'Corsair', price: 52, msrp: 60, rating: 4.5, watts: 650, cert: '80+ Bronze', modular: false },
  { id: 'pure-650', cat: 'psu', name: 'be quiet! Pure Power 12 M 650W Gold', brand: 'be quiet!', price: 80, msrp: 90, rating: 4.7, watts: 650, cert: '80+ Gold', modular: true },
  { id: 'rm750e', cat: 'psu', name: 'Corsair RM750e 750W Gold', brand: 'Corsair', price: 90, msrp: 110, rating: 4.8, watts: 750, cert: '80+ Gold', modular: true },
  { id: 'focus-850', cat: 'psu', name: 'Seasonic FOCUS GX-850 Gold', brand: 'Seasonic', price: 118, msrp: 130, rating: 4.8, watts: 850, cert: '80+ Gold', modular: true },
  { id: 'rm1000e', cat: 'psu', name: 'Corsair RM1000e 1000W Gold', brand: 'Corsair', price: 155, msrp: 180, rating: 4.7, watts: 1000, cert: '80+ Gold', modular: true },
]

export const CASES: Case[] = [
  { id: 'pop-air', cat: 'case', name: 'Fractal Design Pop Air RGB', brand: 'Fractal Design', price: 70, msrp: 89, rating: 4.6, supports: ['ATX', 'Micro-ATX', 'Mini-ITX'], gpuMm: 370, coolerMm: 170, radiator: [120, 240, 280, 360], color: 'Black' },
  { id: 'h5-flow', cat: 'case', name: 'NZXT H5 Flow', brand: 'NZXT', price: 80, msrp: 95, rating: 4.7, supports: ['ATX', 'Micro-ATX', 'Mini-ITX'], gpuMm: 365, coolerMm: 165, radiator: [120, 240, 280], color: 'Black' },
  { id: 'air903-white', cat: 'case', name: 'Montech AIR 903 MAX (White)', brand: 'Montech', price: 75, msrp: 80, rating: 4.6, supports: ['ATX', 'Micro-ATX', 'Mini-ITX'], gpuMm: 380, coolerMm: 175, radiator: [120, 240, 280, 360], color: 'White' },
  { id: 'lancool-216', cat: 'case', name: 'Lian Li Lancool 216', brand: 'Lian Li', price: 100, msrp: 110, rating: 4.9, supports: ['ATX', 'Micro-ATX', 'Mini-ITX'], gpuMm: 392, coolerMm: 180, radiator: [120, 240, 280, 360], color: 'Black' },
  { id: 'nr200p', cat: 'case', name: 'Cooler Master NR200P', brand: 'Cooler Master', price: 80, msrp: 90, rating: 4.8, supports: ['Mini-ITX'], gpuMm: 330, coolerMm: 155, radiator: [120, 240], color: 'Black' },
  { id: 'xt-pro-ultra', cat: 'case', name: 'Phanteks XT Pro Ultra (White)', brand: 'Phanteks', price: 90, msrp: 100, rating: 4.7, supports: ['ATX', 'Micro-ATX', 'Mini-ITX'], gpuMm: 400, coolerMm: 175, radiator: [120, 240, 280, 360], color: 'White' },
]

const ALL_SOCKETS: Cooler['sockets'] = ['AM4', 'AM5', 'LGA1700']
export const COOLERS: Cooler[] = [
  { id: 'se214', cat: 'cooler', name: 'ID-COOLING SE-214-XT', brand: 'ID-COOLING', price: 19, msrp: 25, rating: 4.6, kind: 'Air', sockets: ALL_SOCKETS, heightMm: 150, capacity: 160, noise: 35.5 },
  { id: 'ak400', cat: 'cooler', name: 'DeepCool AK400', brand: 'DeepCool', price: 27, msrp: 30, rating: 4.8, kind: 'Air', sockets: ALL_SOCKETS, heightMm: 155, capacity: 220, noise: 33 },
  { id: 'pa120', cat: 'cooler', name: 'Thermalright Peerless Assassin 120 SE', brand: 'Thermalright', price: 35, msrp: 40, rating: 4.9, kind: 'Air', sockets: ALL_SOCKETS, heightMm: 157, capacity: 265, noise: 31 },
  { id: 'nh-d15', cat: 'cooler', name: 'Noctua NH-D15 chromax.black', brand: 'Noctua', price: 100, msrp: 110, rating: 4.9, kind: 'Air', sockets: ALL_SOCKETS, heightMm: 165, capacity: 250, noise: 24.6 },
  { id: 'le520', cat: 'cooler', name: 'DeepCool LE520 AIO 240mm', brand: 'DeepCool', price: 62, msrp: 70, rating: 4.6, kind: 'AIO', sockets: ALL_SOCKETS, radiator: 240, capacity: 250, noise: 32 },
  { id: 'lf3-240', cat: 'cooler', name: 'ARCTIC Liquid Freezer III 240', brand: 'ARCTIC', price: 85, msrp: 95, rating: 4.8, kind: 'AIO', sockets: ALL_SOCKETS, radiator: 240, capacity: 300, noise: 30 },
  { id: 'lf3-360', cat: 'cooler', name: 'ARCTIC Liquid Freezer III 360', brand: 'ARCTIC', price: 105, msrp: 130, rating: 4.8, kind: 'AIO', sockets: ALL_SOCKETS, radiator: 360, capacity: 350, noise: 28 },
]

export const FANS: FanSet[] = [
  { id: 'p12-3pk', cat: 'fans', name: 'ARCTIC P12 PWM PST 3-Pack', brand: 'ARCTIC', price: 12, msrp: 15, rating: 4.8, count: 3, rgb: false, quiet: true },
  { id: 'tlc12-3pk', cat: 'fans', name: 'Thermalright TL-C12C ARGB 3-Pack', brand: 'Thermalright', price: 16, msrp: 20, rating: 4.6, count: 3, rgb: true, quiet: false },
  { id: 'uni-sl120', cat: 'fans', name: 'Lian Li UNI FAN SL120 3-Pack', brand: 'Lian Li', price: 60, msrp: 75, rating: 4.7, count: 3, rgb: true, quiet: true },
]

export const OSES: OSPart[] = [
  { id: 'win11-retail', cat: 'os', name: 'Windows 11 Home (Retail)', brand: 'Microsoft', price: 139, msrp: 139, rating: 4.2, note: 'Transferable license, activates via Microsoft account.' },
  { id: 'win11-oem', cat: 'os', name: 'Windows 11 Home (OEM)', brand: 'Microsoft', price: 110, msrp: 139, rating: 4.0, note: 'Tied to the first PC it is activated on.' },
  { id: 'ubuntu', cat: 'os', name: 'Ubuntu Linux 24.04 LTS', brand: 'Canonical', price: 0, rating: 4.5, note: 'Free and open source. Some games work best through Proton/Steam Play.' },
]

export const MONITORS: Monitor[] = [
  { id: 'koorui-24e4', cat: 'monitor', name: 'KOORUI 24E4 24" 1080p 100Hz', brand: 'KOORUI', price: 85, msrp: 100, rating: 4.4, res: '1080p', hz: 100, size: 24, panel: 'VA' },
  { id: 'aoc-24g2', cat: 'monitor', name: 'AOC 24G2 24" 1080p 144Hz IPS', brand: 'AOC', price: 120, msrp: 150, rating: 4.7, res: '1080p', hz: 144, size: 24, panel: 'IPS' },
  { id: 'lg-27gp83b', cat: 'monitor', name: 'LG UltraGear 27GP83-B 1440p 165Hz', brand: 'LG', price: 250, msrp: 300, rating: 4.8, res: '1440p', hz: 165, size: 27, panel: 'Nano IPS' },
  { id: 'odyssey-g7', cat: 'monitor', name: 'Samsung Odyssey G7 27" 1440p 240Hz', brand: 'Samsung', price: 400, msrp: 500, rating: 4.5, res: '1440p', hz: 240, size: 27, panel: 'VA' },
  { id: 'm28u', cat: 'monitor', name: 'Gigabyte M28U 28" 4K 144Hz', brand: 'Gigabyte', price: 430, msrp: 500, rating: 4.7, res: '4K', hz: 144, size: 28, panel: 'SS IPS' },
  { id: 'lg-27gr95qe', cat: 'monitor', name: 'LG UltraGear 27GR95QE 1440p 240Hz OLED', brand: 'LG', price: 550, msrp: 800, rating: 4.8, res: '1440p', hz: 240, size: 27, panel: 'OLED' },
]

export const PERIPHERALS: Peripheral[] = [
  { id: 'k552', cat: 'keyboard', name: 'Redragon K552 Kumara', brand: 'Redragon', price: 33, msrp: 40, rating: 4.6, spec: 'Mechanical, red LED, TKL' },
  { id: 'keychron-k3', cat: 'keyboard', name: 'Keychron K3 V2', brand: 'Keychron', price: 65, msrp: 75, rating: 4.6, spec: 'Low-profile mechanical, 75%', wireless: true },
  { id: 'gprox-kb', cat: 'keyboard', name: 'Logitech G PRO X TKL', brand: 'Logitech', price: 95, msrp: 130, rating: 4.5, spec: 'Mechanical, LIGHTSPEED wireless', wireless: true },
  { id: 'g203', cat: 'mouse', name: 'Logitech G203 Lightsync', brand: 'Logitech', price: 22, msrp: 30, rating: 4.7, spec: '8,000 DPI, RGB, wired' },
  { id: 'deathadder', cat: 'mouse', name: 'Razer DeathAdder Essential', brand: 'Razer', price: 25, msrp: 30, rating: 4.6, spec: '6,400 DPI, ergonomic' },
  { id: 'gpx2', cat: 'mouse', name: 'Logitech G PRO X Superlight 2', brand: 'Logitech', price: 135, msrp: 159, rating: 4.8, spec: '44g, HERO 2 sensor, wireless', wireless: true },
  { id: 'stinger-2', cat: 'headset', name: 'HyperX Cloud Stinger 2', brand: 'HyperX', price: 35, msrp: 50, rating: 4.5, spec: 'Wired, lightweight' },
  { id: 'cloud-3', cat: 'headset', name: 'HyperX Cloud III', brand: 'HyperX', price: 95, msrp: 110, rating: 4.7, spec: 'Wired, DTS spatial audio' },
  { id: 'nova-7', cat: 'headset', name: 'SteelSeries Arctis Nova 7', brand: 'SteelSeries', price: 160, msrp: 180, rating: 4.7, spec: 'Wireless 2.4GHz + Bluetooth', wireless: true },
  { id: 't3u-plus', cat: 'wifi', name: 'TP-Link Archer T3U Plus', brand: 'TP-Link', price: 20, msrp: 25, rating: 4.4, spec: 'USB Wi-Fi 5, high-gain antenna' },
  { id: 'axe5400', cat: 'wifi', name: 'ASUS PCE-AXE5400 Wi-Fi 6E', brand: 'ASUS', price: 35, msrp: 40, rating: 4.5, spec: 'PCIe adapter, Bluetooth 5.2' },
]

// ─── Registry & metadata ───────────────────────────────────────────────────

export const DB: Record<Cat, Part[]> = {
  cpu: CPUS, gpu: GPUS, mb: MBS, ram: RAMS, storage: STORAGES,
  psu: PSUS, cooler: COOLERS, case: CASES, fans: FANS, os: OSES,
  monitor: MONITORS, keyboard: PERIPHERALS.filter(p => p.cat === 'keyboard'),
  mouse: PERIPHERALS.filter(p => p.cat === 'mouse'),
  headset: PERIPHERALS.filter(p => p.cat === 'headset'),
  wifi: PERIPHERALS.filter(p => p.cat === 'wifi'),
}

export const ALL_PARTS: Part[] = Object.values(DB).flat()

const INDEX = new Map<string, Part>(ALL_PARTS.map(p => [p.id, p]))
export function getPart(id?: string | null): Part | undefined {
  return id ? INDEX.get(id) : undefined
}
export function getTyped<T extends Part>(cat: Cat, id?: string | null): T | undefined {
  const p = getPart(id)
  return p && p.cat === cat ? (p as T) : undefined
}

export interface CatMeta {
  key: Cat
  label: string
  short: string
  required: boolean
  tip: string
  group: 'Core' | 'Display & Peripherals'
}

export const CATS: CatMeta[] = [
  { key: 'cpu', label: 'Processor (CPU)', short: 'CPU', required: true, group: 'Core', tip: 'The main "brain" of your PC that runs game logic and instructions.' },
  { key: 'cooler', label: 'CPU Cooler', short: 'Cooler', required: true, group: 'Core', tip: 'Keeps your CPU cool. Air towers or all-in-one liquid radiators.' },
  { key: 'mb', label: 'Motherboard', short: 'Motherboard', required: true, group: 'Core', tip: 'The hub everything plugs into. Its socket and chipset decide CPU/RAM support.' },
  { key: 'ram', label: 'Memory (RAM)', short: 'RAM', required: true, group: 'Core', tip: 'Fast temporary memory. 16GB is the minimum for modern gaming, 32GB is comfortable.' },
  { key: 'gpu', label: 'Graphics Card (GPU)', short: 'GPU', required: true, group: 'Core', tip: 'Renders your games. The biggest driver of gaming FPS.' },
  { key: 'storage', label: 'Storage (SSD/HDD)', short: 'Storage', required: true, group: 'Core', tip: 'Where games and files live. NVMe SSDs load fastest.' },
  { key: 'psu', label: 'Power Supply (PSU)', short: 'PSU', required: true, group: 'Core', tip: 'Supplies electricity to every component. Never cheap out here.' },
  { key: 'case', label: 'Case', short: 'Case', required: true, group: 'Core', tip: 'Houses everything. Check GPU length and cooler clearance!' },
  { key: 'fans', label: 'Case Fans', short: 'Fans', required: false, group: 'Core', tip: 'Extra airflow. More airflow = cooler parts and quieter operation.' },
  { key: 'os', label: 'Operating System', short: 'OS', required: false, group: 'Core', tip: 'Windows is required for most games; Linux is a free alternative.' },
  { key: 'monitor', label: 'Monitor', short: 'Monitor', required: false, group: 'Display & Peripherals', tip: 'Pick a refresh rate your PC can actually push FPS for.' },
  { key: 'keyboard', label: 'Keyboard', short: 'Keyboard', required: false, group: 'Display & Peripherals', tip: 'Mechanical keyboards feel better to type and game on for most people.' },
  { key: 'mouse', label: 'Mouse', short: 'Mouse', required: false, group: 'Display & Peripherals', tip: 'Lightweight wireless mice are popular for competitive shooters.' },
  { key: 'headset', label: 'Headset', short: 'Headset', required: false, group: 'Display & Peripherals', tip: 'Positional audio matters in competitive games.' },
  { key: 'wifi', label: 'Wi-Fi / Bluetooth', short: 'Wi-Fi', required: false, group: 'Display & Peripherals', tip: 'Skip if your motherboard already has built-in Wi-Fi.' },
]

export const CORE_CATS: Cat[] = ['cpu', 'gpu', 'mb', 'ram', 'storage', 'psu', 'cooler', 'case']
