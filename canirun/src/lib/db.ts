import Database from "better-sqlite3";
import path from "path";
import { seedNewGames } from "./game-seed";

const DB_PATH = path.join(process.cwd(), "canirun.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeDb(db);
  }
  return db;
}

export { getDb };

function initializeDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cpus (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      series TEXT NOT NULL,
      generation TEXT NOT NULL,
      cores INTEGER NOT NULL,
      threads INTEGER NOT NULL,
      baseClock REAL NOT NULL,
      boostClock REAL NOT NULL,
      tdp INTEGER NOT NULL,
      integratedGraphics TEXT,
      socket TEXT NOT NULL,
      performanceScore INTEGER NOT NULL,
      year INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gpus (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      series TEXT NOT NULL,
      vram INTEGER NOT NULL,
      vramType TEXT NOT NULL,
      tdp INTEGER NOT NULL,
      isLaptop INTEGER NOT NULL DEFAULT 0,
      laptopSuffix TEXT,
      performanceScore INTEGER NOT NULL,
      year INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS laptops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      cpuId TEXT NOT NULL,
      gpuId TEXT NOT NULL,
      ramCapacity INTEGER NOT NULL,
      ramSpeed INTEGER NOT NULL,
      displayResolution TEXT NOT NULL,
      displaySize REAL NOT NULL,
      storageType TEXT NOT NULL,
      storageCapacity INTEGER NOT NULL,
      year INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      genre TEXT NOT NULL,
      developer TEXT NOT NULL,
      publisher TEXT NOT NULL,
      releaseDate TEXT NOT NULL,
      engine TEXT NOT NULL,
      minCpuId TEXT NOT NULL,
      minGpuId TEXT NOT NULL,
      minRamGB INTEGER NOT NULL,
      minStorageGB INTEGER NOT NULL,
      minOs TEXT NOT NULL,
      minDirectX TEXT,
      minNotes TEXT,
      recCpuId TEXT NOT NULL,
      recGpuId TEXT NOT NULL,
      recRamGB INTEGER NOT NULL,
      recStorageGB INTEGER NOT NULL,
      recOs TEXT NOT NULL,
      recDirectX TEXT,
      recNotes TEXT,
      tags TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      cpuId TEXT NOT NULL,
      gpuId TEXT NOT NULL,
      ramGB INTEGER NOT NULL,
      ramSpeed INTEGER NOT NULL,
      storageType TEXT NOT NULL,
      storageCapacity INTEGER NOT NULL,
      displayResolution TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      profileId TEXT NOT NULL,
      profileName TEXT NOT NULL,
      gameId TEXT NOT NULL,
      gameTitle TEXT NOT NULL,
      results TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      image TEXT,
      emailVerified TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_pcs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      cpuId TEXT NOT NULL,
      cpuManufacturer TEXT NOT NULL DEFAULT '',
      cpuModel TEXT NOT NULL DEFAULT '',
      cpuGeneration TEXT NOT NULL DEFAULT '',
      cpuCores INTEGER NOT NULL DEFAULT 0,
      cpuThreads INTEGER NOT NULL DEFAULT 0,
      cpuBaseClock REAL NOT NULL DEFAULT 0,
      cpuBoostClock REAL NOT NULL DEFAULT 0,
      cpuArchitecture TEXT NOT NULL DEFAULT '',
      gpuId TEXT NOT NULL,
      gpuManufacturer TEXT NOT NULL DEFAULT '',
      gpuModel TEXT NOT NULL DEFAULT '',
      gpuIntegrated INTEGER NOT NULL DEFAULT 0,
      gpuVram INTEGER NOT NULL DEFAULT 0,
      gpuVramType TEXT NOT NULL DEFAULT '',
      gpuArchitecture TEXT NOT NULL DEFAULT '',
      gpuDirectX TEXT NOT NULL DEFAULT '',
      ramTotalGB INTEGER NOT NULL DEFAULT 8,
      ramType TEXT NOT NULL DEFAULT 'DDR4',
      ramSpeed INTEGER NOT NULL DEFAULT 3200,
      ramSticks INTEGER NOT NULL DEFAULT 1,
      ramChannels TEXT NOT NULL DEFAULT 'Dual',
      storageType TEXT NOT NULL DEFAULT 'SSD',
      storageCapacityGB INTEGER NOT NULL DEFAULT 512,
      storageFreeGB INTEGER NOT NULL DEFAULT 256,
      displayResolution TEXT NOT NULL DEFAULT '1920x1080',
      displayRefreshRate INTEGER NOT NULL DEFAULT 60,
      displayAspectRatio TEXT NOT NULL DEFAULT '16:9',
      osVersion TEXT NOT NULL DEFAULT 'Windows 11',
      osArch TEXT NOT NULL DEFAULT '64-bit',
      systemType TEXT NOT NULL DEFAULT 'desktop',
      laptopBrand TEXT NOT NULL DEFAULT '',
      laptopModel TEXT NOT NULL DEFAULT '',
      batteryInfo TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      gameId TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, gameId)
    );

    CREATE TABLE IF NOT EXISTS check_history (
      id TEXT PRIMARY KEY,
      userId TEXT,
      pcId TEXT,
      gameId TEXT NOT NULL,
      gameTitle TEXT NOT NULL,
      results TEXT NOT NULL,
      settingsUsed TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    ALTER TABLE games ADD COLUMN IF NOT EXISTS freeToPlay INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE games ADD COLUMN IF NOT EXISTS multiplayer INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE games ADD COLUMN IF NOT EXISTS singlePlayer INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE games ADD COLUMN IF NOT EXISTS controllerSupport INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE games ADD COLUMN IF NOT EXISTS lowEndFriendly INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE games ADD COLUMN IF NOT EXISTS aaa INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE games ADD COLUMN IF NOT EXISTS platforms TEXT NOT NULL DEFAULT 'Windows';
  `);

  const cpuCount = db.prepare("SELECT COUNT(*) as count FROM cpus").get() as { count: number };
  if (cpuCount.count === 0) {
    seedData(db);
  }

  seedNewGames(db);
}

function seedData(db: Database.Database) {
  const insertCpu = db.prepare(`INSERT INTO cpus (id, name, brand, series, generation, cores, threads, baseClock, boostClock, tdp, integratedGraphics, socket, performanceScore, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertGpu = db.prepare(`INSERT INTO gpus (id, name, brand, series, vram, vramType, tdp, isLaptop, laptopSuffix, performanceScore, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertLaptop = db.prepare(`INSERT INTO laptops (id, name, brand, cpuId, gpuId, ramCapacity, ramSpeed, displayResolution, displaySize, storageType, storageCapacity, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertGame = db.prepare(`INSERT INTO games (id, title, genre, developer, publisher, releaseDate, engine, minCpuId, minGpuId, minRamGB, minStorageGB, minOs, minDirectX, minNotes, recCpuId, recGpuId, recRamGB, recStorageGB, recOs, recDirectX, recNotes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const seedAll = db.transaction(() => {
    const cpuData: [string, string, string, string, string, number, number, number, number, number, string | null, string, number, number][] = [
      // Intel 12th Gen
      ["intel-i9-12900k", "Intel Core i9-12900K", "Intel", "Core i9", "12th Gen", 16, 24, 3.2, 5.2, 125, "Intel UHD 770", "LGA 1700", 82, 2021],
      ["intel-i7-12700k", "Intel Core i7-12700K", "Intel", "Core i7", "12th Gen", 12, 20, 3.6, 5.0, 125, "Intel UHD 770", "LGA 1700", 74, 2021],
      ["intel-i5-12600k", "Intel Core i5-12600K", "Intel", "Core i5", "12th Gen", 10, 16, 3.7, 4.9, 125, "Intel UHD 770", "LGA 1700", 67, 2021],
      ["intel-i5-12400", "Intel Core i5-12400", "Intel", "Core i5", "12th Gen", 6, 12, 2.5, 4.4, 65, "Intel UHD 730", "LGA 1700", 55, 2021],
      ["intel-i3-12100", "Intel Core i3-12100", "Intel", "Core i3", "12th Gen", 4, 8, 3.3, 4.3, 60, "Intel UHD 730", "LGA 1700", 42, 2021],
      // Intel 13th Gen
      ["intel-i9-13900k", "Intel Core i9-13900K", "Intel", "Core i9", "13th Gen", 24, 32, 3.0, 5.8, 125, "Intel UHD 770", "LGA 1700", 92, 2022],
      ["intel-i7-13700k", "Intel Core i7-13700K", "Intel", "Core i7", "13th Gen", 16, 24, 3.4, 5.4, 125, "Intel UHD 770", "LGA 1700", 84, 2022],
      ["intel-i5-13600k", "Intel Core i5-13600K", "Intel", "Core i5", "13th Gen", 14, 20, 3.5, 5.1, 125, "Intel UHD 770", "LGA 1700", 76, 2022],
      ["intel-i5-13400", "Intel Core i5-13400", "Intel", "Core i5", "13th Gen", 10, 16, 2.5, 4.6, 65, "Intel UHD 730", "LGA 1700", 62, 2023],
      ["intel-i3-13100", "Intel Core i3-13100", "Intel", "Core i3", "13th Gen", 4, 8, 3.4, 4.5, 60, "Intel UHD 730", "LGA 1700", 45, 2023],
      // Intel 14th Gen
      ["intel-i9-14900k", "Intel Core i9-14900K", "Intel", "Core i9", "14th Gen", 24, 32, 3.2, 6.0, 125, "Intel UHD 770", "LGA 1700", 95, 2023],
      ["intel-i7-14700k", "Intel Core i7-14700K", "Intel", "Core i7", "14th Gen", 20, 28, 3.4, 5.6, 125, "Intel UHD 770", "LGA 1700", 87, 2023],
      ["intel-i5-14600k", "Intel Core i5-14600K", "Intel", "Core i5", "14th Gen", 14, 20, 3.5, 5.3, 125, "Intel UHD 770", "LGA 1700", 78, 2023],
      ["intel-i5-14400", "Intel Core i5-14400", "Intel", "Core i5", "14th Gen", 10, 16, 2.5, 4.7, 65, "Intel UHD 730", "LGA 1700", 64, 2024],
      // Intel Core Ultra (Arrow Lake)
      ["intel-ultra9-285k", "Intel Core Ultra 9 285K", "Intel", "Core Ultra", "Arrow Lake", 24, 24, 3.7, 5.7, 125, "Intel Arc", "LGA 1851", 93, 2024],
      ["intel-ultra7-265k", "Intel Core Ultra 7 265K", "Intel", "Core Ultra", "Arrow Lake", 20, 20, 3.9, 5.5, 125, "Intel Arc", "LGA 1851", 85, 2024],
      ["intel-ultra5-245k", "Intel Core Ultra 5 245K", "Intel", "Core Ultra", "Arrow Lake", 14, 14, 4.2, 5.2, 125, "Intel Arc", "LGA 1851", 77, 2024],
      // Intel Mobile (12th-14th Gen)
      ["intel-i9-13980hx", "Intel Core i9-13980HX", "Intel", "Core i9", "13th Gen Mobile", 24, 32, 2.2, 5.6, 55, "Intel UHD", "BGA 1744", 88, 2023],
      ["intel-i7-13700hx", "Intel Core i7-13700HX", "Intel", "Core i7", "13th Gen Mobile", 16, 24, 2.4, 5.0, 55, "Intel UHD", "BGA 1744", 78, 2023],
      ["intel-i7-13620h", "Intel Core i7-13620H", "Intel", "Core i7", "13th Gen Mobile", 10, 16, 2.4, 4.9, 45, "Intel Iris Xe", "BGA 1744", 70, 2023],
      ["intel-i5-13500h", "Intel Core i5-13500H", "Intel", "Core i5", "13th Gen Mobile", 12, 16, 2.6, 4.7, 45, "Intel Iris Xe", "BGA 1744", 62, 2023],
      ["intel-i5-12450h", "Intel Core i5-12450H", "Intel", "Core i5", "12th Gen Mobile", 8, 12, 2.0, 4.4, 45, "Intel UHD", "BGA 1744", 52, 2022],
      ["intel-i7-12700h", "Intel Core i7-12700H", "Intel", "Core i7", "12th Gen Mobile", 14, 20, 2.3, 4.7, 45, "Intel Iris Xe", "BGA 1744", 72, 2022],
      ["intel-i9-12950hx", "Intel Core i9-12950HX", "Intel", "Core i9", "12th Gen Mobile", 16, 24, 2.3, 5.0, 55, "Intel UHD", "BGA 1744", 82, 2022],
      ["intel-i5-13450hx", "Intel Core i5-13450HX", "Intel", "Core i5", "13th Gen Mobile", 10, 16, 2.4, 4.6, 55, "Intel UHD", "BGA 1744", 58, 2023],
      ["intel-i7-14700hx", "Intel Core i7-14700HX", "Intel", "Core i7", "14th Gen Mobile", 20, 28, 2.1, 5.5, 55, "Intel UHD", "BGA 1744", 86, 2024],
      ["intel-i9-14900hx", "Intel Core i9-14900HX", "Intel", "Core i9", "14th Gen Mobile", 24, 32, 2.2, 5.8, 55, "Intel UHD", "BGA 1744", 91, 2024],
      // AMD Ryzen 5000
      ["amd-ryzen9-5950x", "AMD Ryzen 9 5950X", "AMD", "Ryzen 9", "5000 Series", 16, 32, 3.4, 4.9, 105, null, "AM4", 78, 2020],
      ["amd-ryzen9-5900x", "AMD Ryzen 9 5900X", "AMD", "Ryzen 9", "5000 Series", 12, 24, 3.7, 4.8, 105, null, "AM4", 75, 2020],
      ["amd-ryzen7-5800x3d", "AMD Ryzen 7 5800X3D", "AMD", "Ryzen 7", "5000 Series", 8, 16, 3.4, 4.5, 105, null, "AM4", 77, 2022],
      ["amd-ryzen7-5800x", "AMD Ryzen 7 5800X", "AMD", "Ryzen 7", "5000 Series", 8, 16, 3.8, 4.7, 105, null, "AM4", 71, 2020],
      ["amd-ryzen5-5600x", "AMD Ryzen 5 5600X", "AMD", "Ryzen 5", "5000 Series", 6, 12, 3.7, 4.6, 65, null, "AM4", 62, 2020],
      ["amd-ryzen5-5600", "AMD Ryzen 5 5600", "AMD", "Ryzen 5", "5000 Series", 6, 12, 3.5, 4.4, 65, null, "AM4", 58, 2022],
      ["amd-ryzen5-5500", "AMD Ryzen 5 5500", "AMD", "Ryzen 5", "5000 Series", 6, 12, 3.6, 4.2, 65, null, "AM4", 52, 2022],
      ["amd-ryzen3-5300g", "AMD Ryzen 3 5300G", "AMD", "Ryzen 3", "5000 Series", 4, 8, 3.9, 4.2, 65, "Radeon Vega 6", "AM4", 42, 2021],
      // AMD Ryzen 7000
      ["amd-ryzen9-7950x", "AMD Ryzen 9 7950X", "AMD", "Ryzen 9", "7000 Series", 16, 32, 4.5, 5.7, 170, null, "AM5", 94, 2022],
      ["amd-ryzen9-7900x", "AMD Ryzen 9 7900X", "AMD", "Ryzen 9", "7000 Series", 12, 24, 4.7, 5.6, 170, null, "AM5", 88, 2022],
      ["amd-ryzen7-7800x3d", "AMD Ryzen 7 7800X3D", "AMD", "Ryzen 7", "7000 Series", 8, 16, 4.2, 5.0, 120, null, "AM5", 90, 2023],
      ["amd-ryzen7-7700x", "AMD Ryzen 7 7700X", "AMD", "Ryzen 7", "7000 Series", 8, 16, 4.5, 5.4, 105, null, "AM5", 82, 2022],
      ["amd-ryzen5-7600x", "AMD Ryzen 5 7600X", "AMD", "Ryzen 5", "7000 Series", 6, 12, 4.7, 5.3, 105, null, "AM5", 72, 2022],
      ["amd-ryzen5-7600", "AMD Ryzen 5 7600", "AMD", "Ryzen 5", "7000 Series", 6, 12, 3.8, 5.1, 65, null, "AM5", 68, 2023],
      ["amd-ryzen5-7500f", "AMD Ryzen 5 7500F", "AMD", "Ryzen 5", "7000 Series", 6, 12, 3.7, 5.0, 65, null, "AM5", 64, 2023],
      // AMD Ryzen 9000
      ["amd-ryzen9-9950x", "AMD Ryzen 9 9950X", "AMD", "Ryzen 9", "9000 Series", 16, 32, 4.3, 5.7, 170, null, "AM5", 96, 2024],
      ["amd-ryzen9-9900x", "AMD Ryzen 9 9900X", "AMD", "Ryzen 9", "9000 Series", 12, 24, 4.4, 5.6, 120, null, "AM5", 90, 2024],
      ["amd-ryzen7-9700x", "AMD Ryzen 7 9700X", "AMD", "Ryzen 7", "9000 Series", 8, 16, 3.8, 5.5, 65, null, "AM5", 83, 2024],
      ["amd-ryzen5-9600x", "AMD Ryzen 5 9600X", "AMD", "Ryzen 5", "9000 Series", 6, 12, 3.9, 5.4, 65, null, "AM5", 74, 2024],
      // AMD Mobile
      ["amd-ryzen9-7945hx", "AMD Ryzen 9 7945HX", "AMD", "Ryzen 9", "7000 Mobile", 16, 32, 2.5, 5.4, 55, null, "FL1", 90, 2023],
      ["amd-ryzen7-7840hs", "AMD Ryzen 7 7840HS", "AMD", "Ryzen 7", "7000 Mobile", 8, 16, 3.8, 5.1, 35, "Radeon 780M", "FP7", 75, 2023],
      ["amd-ryzen7-7735hs", "AMD Ryzen 7 7735HS", "AMD", "Ryzen 7", "7000 Mobile", 8, 16, 3.2, 4.7, 35, "Radeon 680M", "FP7", 68, 2023],
      ["amd-ryzen5-7640hs", "AMD Ryzen 5 7640HS", "AMD", "Ryzen 5", "7000 Mobile", 6, 12, 4.3, 5.0, 35, "Radeon 760M", "FP7", 65, 2023],
      ["amd-ryzen5-7535hs", "AMD Ryzen 5 7535HS", "AMD", "Ryzen 5", "7000 Mobile", 6, 12, 3.3, 4.5, 35, "Radeon 660M", "FP7", 58, 2023],
      ["amd-ryzen9-8945hs", "AMD Ryzen 9 8945HS", "AMD", "Ryzen 9", "8000 Mobile", 8, 16, 4.0, 5.2, 45, "Radeon 780M", "FP8", 78, 2024],
      ["amd-ryzen7-8845hs", "AMD Ryzen 7 8845HS", "AMD", "Ryzen 7", "8000 Mobile", 8, 16, 3.8, 5.1, 35, "Radeon 780M", "FP7", 76, 2024],
      ["amd-ryzen5-8645hs", "AMD Ryzen 5 8645HS", "AMD", "Ryzen 5", "8000 Mobile", 6, 12, 4.3, 5.0, 35, "Radeon 760M", "FP7", 66, 2024],
      // Older/budget CPUs
      ["intel-i9-11900k", "Intel Core i9-11900K", "Intel", "Core i9", "11th Gen", 8, 16, 3.5, 5.2, 125, "Intel UHD 750", "LGA 1200", 65, 2021],
      ["intel-i7-11700k", "Intel Core i7-11700K", "Intel", "Core i7", "11th Gen", 8, 16, 3.6, 5.0, 125, "Intel UHD 750", "LGA 1200", 61, 2021],
      ["intel-i5-11400", "Intel Core i5-11400", "Intel", "Core i5", "11th Gen", 6, 12, 2.6, 4.4, 65, "Intel UHD 730", "LGA 1200", 48, 2021],
      ["amd-ryzen5-3600", "AMD Ryzen 5 3600", "AMD", "Ryzen 5", "3000 Series", 6, 12, 3.6, 4.2, 65, null, "AM4", 48, 2019],
      ["amd-ryzen7-3700x", "AMD Ryzen 7 3700X", "AMD", "Ryzen 7", "3000 Series", 8, 16, 3.6, 4.4, 65, null, "AM4", 55, 2019],
      ["amd-ryzen9-3900x", "AMD Ryzen 9 3900X", "AMD", "Ryzen 9", "3000 Series", 12, 24, 3.8, 4.6, 105, null, "AM4", 62, 2019],
      ["intel-i5-10400", "Intel Core i5-10400", "Intel", "Core i5", "10th Gen", 6, 12, 2.9, 4.3, 65, "Intel UHD 630", "LGA 1200", 40, 2020],
    ];

    for (const c of cpuData) {
      insertCpu.run(...c);
    }

    const gpuData: [string, string, string, string, number, string, number, number, string | null, number, number][] = [
      // NVIDIA RTX 40 Series
      ["nvidia-rtx4090", "NVIDIA GeForce RTX 4090", "NVIDIA", "RTX 40", 24, "GDDR6X", 450, 0, null, 100, 2022],
      ["nvidia-rtx4080-super", "NVIDIA GeForce RTX 4080 Super", "NVIDIA", "RTX 40", 16, "GDDR6X", 320, 0, null, 91, 2024],
      ["nvidia-rtx4080", "NVIDIA GeForce RTX 4080", "NVIDIA", "RTX 40", 16, "GDDR6X", 320, 0, null, 88, 2022],
      ["nvidia-rtx4070-ti-super", "NVIDIA GeForce RTX 4070 Ti Super", "NVIDIA", "RTX 40", 16, "GDDR6X", 285, 0, null, 82, 2024],
      ["nvidia-rtx4070-ti", "NVIDIA GeForce RTX 4070 Ti", "NVIDIA", "RTX 40", 12, "GDDR6X", 285, 0, null, 78, 2023],
      ["nvidia-rtx4070-super", "NVIDIA GeForce RTX 4070 Super", "NVIDIA", "RTX 40", 12, "GDDR6X", 220, 0, null, 74, 2024],
      ["nvidia-rtx4070", "NVIDIA GeForce RTX 4070", "NVIDIA", "RTX 40", 12, "GDDR6X", 200, 0, null, 70, 2023],
      ["nvidia-rtx4060-ti", "NVIDIA GeForce RTX 4060 Ti", "NVIDIA", "RTX 40", 8, "GDDR6", 160, 0, null, 64, 2023],
      ["nvidia-rtx4060", "NVIDIA GeForce RTX 4060", "NVIDIA", "RTX 40", 8, "GDDR6", 115, 0, null, 56, 2023],
      // NVIDIA RTX 30 Series
      ["nvidia-rtx3090-ti", "NVIDIA GeForce RTX 3090 Ti", "NVIDIA", "RTX 30", 24, "GDDR6X", 450, 0, null, 85, 2022],
      ["nvidia-rtx3090", "NVIDIA GeForce RTX 3090", "NVIDIA", "RTX 30", 24, "GDDR6X", 350, 0, null, 82, 2020],
      ["nvidia-rtx3080-ti", "NVIDIA GeForce RTX 3080 Ti", "NVIDIA", "RTX 30", 12, "GDDR6X", 350, 0, null, 79, 2021],
      ["nvidia-rtx3080", "NVIDIA GeForce RTX 3080", "NVIDIA", "RTX 30", 10, "GDDR6X", 320, 0, null, 76, 2020],
      ["nvidia-rtx3070-ti", "NVIDIA GeForce RTX 3070 Ti", "NVIDIA", "RTX 30", 8, "GDDR6X", 290, 0, null, 70, 2021],
      ["nvidia-rtx3070", "NVIDIA GeForce RTX 3070", "NVIDIA", "RTX 30", 8, "GDDR6", 220, 0, null, 67, 2020],
      ["nvidia-rtx3060-ti", "NVIDIA GeForce RTX 3060 Ti", "NVIDIA", "RTX 30", 8, "GDDR6", 200, 0, null, 62, 2020],
      ["nvidia-rtx3060", "NVIDIA GeForce RTX 3060", "NVIDIA", "RTX 30", 12, "GDDR6", 170, 0, null, 55, 2021],
      ["nvidia-rtx3050", "NVIDIA GeForce RTX 3050", "NVIDIA", "RTX 30", 8, "GDDR6", 130, 0, null, 42, 2022],
      // NVIDIA RTX 20 Series
      ["nvidia-rtx2080-ti", "NVIDIA GeForce RTX 2080 Ti", "NVIDIA", "RTX 20", 11, "GDDR6", 250, 0, null, 68, 2018],
      ["nvidia-rtx2080-super", "NVIDIA GeForce RTX 2080 Super", "NVIDIA", "RTX 20", 8, "GDDR6", 250, 0, null, 63, 2019],
      ["nvidia-rtx2070-super", "NVIDIA GeForce RTX 2070 Super", "NVIDIA", "RTX 20", 8, "GDDR6", 215, 0, null, 58, 2019],
      ["nvidia-rtx2060-super", "NVIDIA GeForce RTX 2060 Super", "NVIDIA", "RTX 20", 8, "GDDR6", 175, 0, null, 52, 2019],
      ["nvidia-rtx2060", "NVIDIA GeForce RTX 2060", "NVIDIA", "RTX 20", 6, "GDDR6", 160, 0, null, 46, 2019],
      // NVIDIA GTX
      ["nvidia-gtx1660-ti", "NVIDIA GeForce GTX 1660 Ti", "NVIDIA", "GTX 16", 6, "GDDR6", 120, 0, null, 38, 2019],
      ["nvidia-gtx1660-super", "NVIDIA GeForce GTX 1660 Super", "NVIDIA", "GTX 16", 6, "GDDR6", 125, 0, null, 37, 2019],
      ["nvidia-gtx1650-super", "NVIDIA GeForce GTX 1650 Super", "NVIDIA", "GTX 16", 4, "GDDR6", 100, 0, null, 30, 2019],
      ["nvidia-gtx1650", "NVIDIA GeForce GTX 1650", "NVIDIA", "GTX 16", 4, "GDDR5", 75, 0, null, 25, 2019],
      ["nvidia-gtx1080-ti", "NVIDIA GeForce GTX 1080 Ti", "NVIDIA", "GTX 10", 11, "GDDR5X", 250, 0, null, 58, 2017],
      ["nvidia-gtx1070-ti", "NVIDIA GeForce GTX 1070 Ti", "NVIDIA", "GTX 10", 8, "GDDR5", 180, 0, null, 48, 2017],
      ["nvidia-gtx1070", "NVIDIA GeForce GTX 1070", "NVIDIA", "GTX 10", 8, "GDDR5", 150, 0, null, 44, 2016],
      ["nvidia-gtx1060-6gb", "NVIDIA GeForce GTX 1060 6GB", "NVIDIA", "GTX 10", 6, "GDDR5", 120, 0, null, 35, 2016],
      ["nvidia-gtx1050-ti", "NVIDIA GeForce GTX 1050 Ti", "NVIDIA", "GTX 10", 4, "GDDR5", 75, 0, null, 22, 2016],
      // NVIDIA Laptop GPUs
      ["nvidia-rtx4090-laptop", "NVIDIA GeForce RTX 4090 Laptop", "NVIDIA", "RTX 40", 16, "GDDR6", 150, 1, "Laptop", 80, 2023],
      ["nvidia-rtx4080-laptop", "NVIDIA GeForce RTX 4080 Laptop", "NVIDIA", "RTX 40", 12, "GDDR6", 150, 1, "Laptop", 72, 2023],
      ["nvidia-rtx4070-laptop", "NVIDIA GeForce RTX 4070 Laptop", "NVIDIA", "RTX 40", 8, "GDDR6", 115, 1, "Laptop", 65, 2023],
      ["nvidia-rtx4060-laptop", "NVIDIA GeForce RTX 4060 Laptop", "NVIDIA", "RTX 40", 8, "GDDR6", 100, 1, "Laptop", 56, 2023],
      ["nvidia-rtx4050-laptop", "NVIDIA GeForce RTX 4050 Laptop", "NVIDIA", "RTX 40", 6, "GDDR6", 75, 1, "Laptop", 45, 2023],
      ["nvidia-rtx3080-laptop", "NVIDIA GeForce RTX 3080 Laptop", "NVIDIA", "RTX 30", 16, "GDDR6", 150, 1, "Laptop", 68, 2021],
      ["nvidia-rtx3070-laptop", "NVIDIA GeForce RTX 3070 Laptop", "NVIDIA", "RTX 30", 8, "GDDR6", 125, 1, "Laptop", 60, 2021],
      ["nvidia-rtx3060-laptop", "NVIDIA GeForce RTX 3060 Laptop", "NVIDIA", "RTX 30", 6, "GDDR6", 115, 1, "Laptop", 50, 2021],
      ["nvidia-rtx3050-laptop", "NVIDIA GeForce RTX 3050 Laptop", "NVIDIA", "RTX 30", 4, "GDDR6", 75, 1, "Laptop", 35, 2021],
      ["nvidia-rtx2080-super-laptop", "NVIDIA GeForce RTX 2080 Super Laptop", "NVIDIA", "RTX 20", 8, "GDDR6", 150, 1, "Laptop", 58, 2020],
      ["nvidia-rtx2070-laptop", "NVIDIA GeForce RTX 2070 Laptop", "NVIDIA", "RTX 20", 8, "GDDR6", 115, 1, "Laptop", 48, 2020],
      ["nvidia-rtx2060-laptop", "NVIDIA GeForce RTX 2060 Laptop", "NVIDIA", "RTX 20", 6, "GDDR6", 90, 1, "Laptop", 40, 2020],
      ["nvidia-gtx1660-ti-laptop", "NVIDIA GeForce GTX 1660 Ti Laptop", "NVIDIA", "GTX 16", 6, "GDDR6", 80, 1, "Laptop", 35, 2019],
      ["nvidia-gtx1650-laptop", "NVIDIA GeForce GTX 1650 Laptop", "NVIDIA", "GTX 16", 4, "GDDR5", 50, 1, "Laptop", 23, 2019],
      // NVIDIA RTX 50 Series
      ["nvidia-rtx5090", "NVIDIA GeForce RTX 5090", "NVIDIA", "RTX 50", 32, "GDDR7", 575, 0, null, 100, 2025],
      ["nvidia-rtx5080", "NVIDIA GeForce RTX 5080", "NVIDIA", "RTX 50", 16, "GDDR7", 360, 0, null, 88, 2025],
      ["nvidia-rtx5070-ti", "NVIDIA GeForce RTX 5070 Ti", "NVIDIA", "RTX 50", 16, "GDDR7", 300, 0, null, 78, 2025],
      ["nvidia-rtx5070", "NVIDIA GeForce RTX 5070", "NVIDIA", "RTX 50", 12, "GDDR7", 250, 0, null, 72, 2025],
      ["nvidia-rtx5060-ti", "NVIDIA GeForce RTX 5060 Ti", "NVIDIA", "RTX 50", 16, "GDDR7", 180, 0, null, 65, 2025],
      ["nvidia-rtx5060", "NVIDIA GeForce RTX 5060", "NVIDIA", "RTX 50", 8, "GDDR7", 150, 0, null, 58, 2025],
      // AMD Radeon RX 7000
      ["amd-rx7900xtx", "AMD Radeon RX 7900 XTX", "AMD", "RX 7000", 24, "GDDR6", 355, 0, null, 85, 2022],
      ["amd-rx7900xt", "AMD Radeon RX 7900 XT", "AMD", "RX 7000", 20, "GDDR6", 315, 0, null, 78, 2023],
      ["amd-rx7900gre", "AMD Radeon RX 7900 GRE", "AMD", "RX 7000", 16, "GDDR6", 260, 0, null, 70, 2024],
      ["amd-rx7800xt", "AMD Radeon RX 7800 XT", "AMD", "RX 7000", 16, "GDDR6", 263, 0, null, 68, 2023],
      ["amd-rx7700xt", "AMD Radeon RX 7700 XT", "AMD", "RX 7000", 12, "GDDR6", 245, 0, null, 60, 2023],
      ["amd-rx7600", "AMD Radeon RX 7600", "AMD", "RX 7000", 8, "GDDR6", 165, 0, null, 48, 2023],
      ["amd-rx7600xt", "AMD Radeon RX 7600 XT", "AMD", "RX 7000", 16, "GDDR6", 150, 0, null, 52, 2024],
      // AMD Radeon RX 6000
      ["amd-rx6950xt", "AMD Radeon RX 6950 XT", "AMD", "RX 6000", 16, "GDDR6", 335, 0, null, 76, 2022],
      ["amd-rx6900xt", "AMD Radeon RX 6900 XT", "AMD", "RX 6000", 16, "GDDR6", 300, 0, null, 73, 2020],
      ["amd-rx6800xt", "AMD Radeon RX 6800 XT", "AMD", "RX 6000", 16, "GDDR6", 300, 0, null, 68, 2020],
      ["amd-rx6800", "AMD Radeon RX 6800", "AMD", "RX 6000", 16, "GDDR6", 250, 0, null, 62, 2020],
      ["amd-rx6750xt", "AMD Radeon RX 6750 XT", "AMD", "RX 6000", 12, "GDDR6", 250, 0, null, 57, 2022],
      ["amd-rx6700xt", "AMD Radeon RX 6700 XT", "AMD", "RX 6000", 12, "GDDR6", 230, 0, null, 54, 2021],
      ["amd-rx6650xt", "AMD Radeon RX 6650 XT", "AMD", "RX 6000", 8, "GDDR6", 180, 0, null, 48, 2022],
      ["amd-rx6600xt", "AMD Radeon RX 6600 XT", "AMD", "RX 6000", 8, "GDDR6", 160, 0, null, 45, 2021],
      ["amd-rx6600", "AMD Radeon RX 6600", "AMD", "RX 6000", 8, "GDDR6", 132, 0, null, 40, 2021],
      ["amd-rx6500xt", "AMD Radeon RX 6500 XT", "AMD", "RX 6000", 4, "GDDR6", 107, 0, null, 28, 2022],
      // AMD Radeon RX 5000
      ["amd-rx5700xt", "AMD Radeon RX 5700 XT", "AMD", "RX 5000", 8, "GDDR6", 225, 0, null, 48, 2019],
      ["amd-rx5700", "AMD Radeon RX 5700", "AMD", "RX 5000", 8, "GDDR6", 180, 0, null, 42, 2019],
      ["amd-rx5600xt", "AMD Radeon RX 5600 XT", "AMD", "RX 5000", 6, "GDDR6", 150, 0, null, 38, 2020],
      // AMD older
      ["amd-rx580-8gb", "AMD Radeon RX 580 8GB", "AMD", "RX 500", 8, "GDDR5", 185, 0, null, 30, 2017],
      ["amd-rx570-4gb", "AMD Radeon RX 570 4GB", "AMD", "RX 500", 4, "GDDR5", 150, 0, null, 25, 2017],
      // Intel Arc
      ["intel-arc-a770", "Intel Arc A770", "Intel", "Arc A", 16, "GDDR6", 225, 0, null, 46, 2022],
      ["intel-arc-a750", "Intel Arc A750", "Intel", "Arc A", 8, "GDDR6", 225, 0, null, 42, 2022],
      ["intel-arc-a580", "Intel Arc A580", "Intel", "Arc A", 10, "GDDR6", 185, 0, null, 38, 2023],
      ["intel-arc-a380", "Intel Arc A380", "Intel", "Arc A", 6, "GDDR6", 75, 0, null, 22, 2022],
      ["intel-arc-b580", "Intel Arc B580", "Intel", "Arc B", 12, "GDDR6", 150, 0, null, 50, 2024],
      // Integrated Graphics (for min requirements)
      ["igpu-intel-uhd630", "Intel UHD Graphics 630", "Intel", "Integrated", 0, "Shared", 15, 0, "Integrated", 8, 2018],
      ["igpu-intel-uhd730", "Intel UHD Graphics 730", "Intel", "Integrated", 0, "Shared", 15, 0, "Integrated", 10, 2021],
      ["igpu-intel-uhd770", "Intel UHD Graphics 770", "Intel", "Integrated", 0, "Shared", 15, 0, "Integrated", 12, 2021],
      ["igpu-intel-iris-xe", "Intel Iris Xe Graphics", "Intel", "Integrated", 0, "Shared", 15, 0, "Integrated", 14, 2020],
      ["igpu-amd-vega6", "AMD Radeon Vega 6", "AMD", "Integrated", 0, "Shared", 15, 0, "Integrated", 7, 2018],
      ["igpu-amd-vega8", "AMD Radeon Vega 8", "AMD", "Integrated", 0, "Shared", 15, 0, "Integrated", 9, 2018],
      ["igpu-amd-radeon660m", "AMD Radeon 660M", "AMD", "Integrated", 0, "Shared", 15, 0, "Integrated", 11, 2023],
      ["igpu-amd-radeon680m", "AMD Radeon 680M", "AMD", "Integrated", 0, "Shared", 15, 0, "Integrated", 15, 2023],
      ["igpu-amd-radeon760m", "AMD Radeon 760M", "AMD", "Integrated", 0, "Shared", 15, 0, "Integrated", 13, 2023],
      ["igpu-amd-radeon780m", "AMD Radeon 780M", "AMD", "Integrated", 0, "Shared", 15, 0, "Integrated", 18, 2023],
      ["igpu-intel-arc-graphics", "Intel Arc Graphics (Integrated)", "Intel", "Integrated", 0, "Shared", 15, 0, "Integrated", 16, 2024],
    ];

    for (const g of gpuData) {
      insertGpu.run(...g);
    }

    const laptopData: [string, string, string, string, string, number, number, string, number, string, number, number][] = [
      ["laptop-razer-blade-16-2024", "Razer Blade 16 (2024)", "Razer", "intel-i9-14900hx", "nvidia-rtx4090-laptop", 32, 5600, "2560x1600", 16, "NVMe", 2000, 2024],
      ["laptop-asus-rog-strix-g16-2024", "ASUS ROG Strix G16 (2024)", "ASUS", "intel-i9-14900hx", "nvidia-rtx4070-laptop", 32, 4800, "2560x1600", 16, "NVMe", 1000, 2024],
      ["laptop-lenovo-legion-pro-7-2024", "Lenovo Legion Pro 7i (2024)", "Lenovo", "intel-i9-14900hx", "nvidia-rtx4080-laptop", 32, 5600, "2560x1600", 16, "NVMe", 2000, 2024],
      ["laptop-msi-titan-18-2024", "MSI Titan 18 HX (2024)", "MSI", "intel-i9-14900hx", "nvidia-rtx4090-laptop", 64, 5600, "3840x2400", 18, "NVMe", 4000, 2024],
      ["laptop-asus-zephyrus-g16-2024", "ASUS ROG Zephyrus G16 (2024)", "ASUS", "intel-ultra9-285k", "nvidia-rtx4070-laptop", 32, 5600, "2560x1600", 16, "NVMe", 1000, 2024],
      ["laptop-hp-omen-16-2024", "HP OMEN 16 (2024)", "HP", "amd-ryzen9-8945hs", "nvidia-rtx4070-laptop", 32, 5600, "2560x1440", 16, "NVMe", 1000, 2024],
      ["laptop-dell-g16-2024", "Dell G16 (2024)", "Dell", "intel-i7-14700hx", "nvidia-rtx4060-laptop", 16, 4800, "2560x1600", 16, "NVMe", 512, 2024],
      ["laptop-acer-nitro-v-15-2024", "Acer Nitro V 15 (2024)", "Acer", "intel-i7-13620h", "nvidia-rtx4050-laptop", 16, 4800, "1920x1080", 15, "NVMe", 512, 2024],
      ["laptop-macbook-pro-16-m3-max", "MacBook Pro 16\" M3 Max", "Apple", "amd-ryzen9-7945hx", "nvidia-rtx4090-laptop", 36, 6400, "3456x2234", 16, "NVMe", 1000, 2024],
      ["laptop-asus-rog-flow-x16-2023", "ASUS ROG Flow X16 (2023)", "ASUS", "amd-ryzen9-7945hx", "nvidia-rtx4070-laptop", 32, 4800, "2560x1600", 16, "NVMe", 1000, 2023],
      ["laptop-lenovo-legion-5-2023", "Lenovo Legion 5 (2023)", "Lenovo", "amd-ryzen7-7840hs", "nvidia-rtx4060-laptop", 16, 4800, "2560x1440", 15, "NVMe", 512, 2023],
      ["laptop-asus-tuf-gaming-a15-2023", "ASUS TUF Gaming A15 (2023)", "ASUS", "amd-ryzen7-7735hs", "nvidia-rtx4060-laptop", 16, 4800, "1920x1080", 15, "NVMe", 512, 2023],
      ["laptop-msi-raider-ge76-2022", "MSI Raider GE76 (2022)", "MSI", "intel-i9-12950hx", "nvidia-rtx3080-laptop", 32, 4800, "1920x1080", 17, "NVMe", 1000, 2022],
      ["laptop-razer-blade-15-2022", "Razer Blade 15 (2022)", "Razer", "intel-i7-12700h", "nvidia-rtx3070-laptop", 16, 4800, "2560x1440", 15, "NVMe", 1000, 2022],
      ["laptop-acer-nitro-5-2022", "Acer Nitro 5 (2022)", "Acer", "intel-i5-12500h", "nvidia-rtx3060-laptop", 16, 3200, "1920x1080", 15, "NVMe", 512, 2022],
      ["laptop-hp-pavilion-gaming-15-2021", "HP Pavilion Gaming 15 (2021)", "HP", "amd-ryzen5-7535hs", "nvidia-rtx3050-laptop", 8, 3200, "1920x1080", 15, "NVMe", 256, 2021],
      ["laptop-dell-inspiron-15-2023", "Dell Inspiron 15 (2023)", "Dell", "intel-i5-13450hx", "igpu-intel-uhd730", 8, 3200, "1920x1080", 15, "SSD", 512, 2023],
      ["laptop-lenovo-ideapad-3-2023", "Lenovo IdeaPad 3 (2023)", "Lenovo", "amd-ryzen5-7535hs", "igpu-amd-radeon660m", 8, 4800, "1920x1080", 15, "NVMe", 256, 2023],
    ];

    for (const l of laptopData) {
      insertLaptop.run(...l);
    }

    const gameData: [string, string, string, string, string, string, string, string, string, number, number, string, string | null, string | null, string, string, number, number, string, string | null, string | null, string][] = [
      [
        "cyberpunk-2077", "Cyberpunk 2077", "RPG", "CD Projekt Red", "CD Projekt", "2020-12-10", "REDengine 4",
        "intel-i5-6700", "nvidia-gtx1060-6gb", 8, 70, "Windows 10", "DirectX 12", "SSD recommended",
        "intel-i7-12700k", "nvidia-rtx3060", 16, 70, "Windows 10", "DirectX 12", "SSD required",
        '["open-world","sci-fi","fps","rpg"]'
      ],
      [
        "gta-v", "Grand Theft Auto V", "Action", "Rockstar North", "Rockstar Games", "2013-09-17", "RAGE",
        "intel-i5-3470", "nvidia-gtx660", 8, 72, "Windows 10", "DirectX 11", null,
        "intel-i7-4770k", "nvidia-gtx780", 16, 72, "Windows 10", "DirectX 11", null,
        '["open-world","action","sandbox","multiplayer"]'
      ],
      [
        "fortnite", "Fortnite", "Shooter", "Epic Games", "Epic Games", "2017-07-25", "Unreal Engine 5",
        "intel-i3-3225", "igpu-intel-uhd630", 8, 80, "Windows 10", "DirectX 11", null,
        "intel-i5-9600k", "nvidia-rtx2060", 16, 80, "Windows 10", "DirectX 12", null,
        '["battle-royale","shooter","free-to-play","multiplayer"]'
      ],
      [
        "elden-ring", "Elden Ring", "RPG", "FromSoftware", "Bandai Namco", "2022-02-25", "FromSoft Engine",
        "intel-i5-8400", "nvidia-gtx1060-6gb", 12, 50, "Windows 10", "DirectX 12", null,
        "intel-i7-8700k", "nvidia-rtx2060", 16, 50, "Windows 10", "DirectX 12", null,
        '["action-rpg","open-world","souls-like","multiplayer"]'
      ],
      [
        "baldurs-gate-3", "Baldur's Gate 3", "RPG", "Larian Studios", "Larian Studios", "2023-08-03", "Divinity Engine 4",
        "intel-i5-4690k", "nvidia-gtx970", 8, 150, "Windows 10", "DirectX 11", null,
        "intel-i7-8700k", "nvidia-rtx2060", 16, 150, "Windows 10", "DirectX 11", null,
        '["rpg","turn-based","fantasy","multiplayer"]'
      ],
      [
        "red-dead-redemption-2", "Red Dead Redemption 2", "Action", "Rockstar Studios", "Rockstar Games", "2018-10-26", "RAGE",
        "intel-i5-2500k", "nvidia-gtx770", 8, 150, "Windows 7", "DirectX 11", null,
        "intel-i7-4770k", "nvidia-gtx1060-6gb", 12, 150, "Windows 10", "DirectX 12", null,
        '["open-world","action","western","multiplayer"]'
      ],
      [
        "cod-modern-warfare-iii", "Call of Duty: Modern Warfare III", "Shooter", "Sledgehammer Games", "Activision", "2023-11-10", "IW Engine",
        "intel-i5-6600k", "nvidia-gtx1050-ti", 8, 125, "Windows 10", "DirectX 12", null,
        "intel-i7-8700k", "nvidia-rtx3060", 16, 125, "Windows 10", "DirectX 12", null,
        '["fps","shooter","multiplayer","military"]'
      ],
      [
        "minecraft", "Minecraft", "Sandbox", "Mojang Studios", "Mojang Studios", "2011-11-18", "Java/C++",
        "intel-celeron-j4105", "igpu-intel-uhd630", 4, 4, "Windows 10", null, "Java Edition or Bedrock",
        "intel-i5-4690k", "nvidia-rtx2060", 8, 4, "Windows 10", null, "With ray tracing shaders",
        '["sandbox","survival","creative","multiplayer"]'
      ],
      [
        "counter-strike-2", "Counter-Strike 2", "Shooter", "Valve", "Valve", "2023-09-27", "Source 2",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 8, 85, "Windows 10", "DirectX 11", null,
        "intel-i5-9400f", "nvidia-rtx2060", 16, 85, "Windows 10", "DirectX 11", null,
        '["fps","shooter","competitive","multiplayer"]'
      ],
      [
        "hogwarts-legacy", "Hogwarts Legacy", "RPG", "Avalanche Software", "Warner Bros.", "2023-02-10", "Unreal Engine 4",
        "intel-i5-6600", "nvidia-gtx1050-ti", 16, 85, "Windows 10", "DirectX 12", null,
        "intel-i7-8700k", "nvidia-rtx2080", 16, 85, "Windows 10", "DirectX 12", null,
        '["rpg","open-world","magic","action"]'
      ],
      [
        "starfield", "Starfield", "RPG", "Bethesda Game Studios", "Bethesda Softworks", "2023-09-06", "Creation Engine 2",
        "intel-i5-10400", "nvidia-rtx2060", 16, 125, "Windows 10", "DirectX 12", "SSD required",
        "intel-i7-12700k", "nvidia-rtx4080", 32, 125, "Windows 10", "DirectX 12", "SSD required",
        '["rpg","open-world","sci-fi","exploration"]'
      ],
      [
        "diablo-4", "Diablo IV", "RPG", "Blizzard Entertainment", "Blizzard Entertainment", "2023-06-06", "Custom",
        "intel-i3-3250", "nvidia-gtx660", 8, 90, "Windows 10", "DirectX 12", null,
        "intel-i7-8700k", "nvidia-rtx2060", 16, 90, "Windows 10", "DirectX 12", null,
        '["action-rpg","hack-and-slash","multiplayer","dark-fantasy"]'
      ],
      [
        "the-witcher-3-wild-hunt", "The Witcher 3: Wild Hunt", "RPG", "CD Projekt Red", "CD Projekt", "2015-05-19", "REDengine 3",
        "intel-i5-2500k", "nvidia-gtx660", 6, 50, "Windows 7", "DirectX 11", null,
        "intel-i7-4770k", "nvidia-gtx1070", 8, 50, "Windows 10", "DirectX 12", null,
        '["rpg","open-world","fantasy","action"]'
      ],
      [
        "apex-legends", "Apex Legends", "Shooter", "Respawn Entertainment", "Electronic Arts", "2019-02-04", "Source Engine",
        "intel-core2duo-e6600", "nvidia-gtx660", 6, 75, "Windows 7", "DirectX 11", null,
        "intel-i5-3570k", "nvidia-gtx1060-6gb", 8, 75, "Windows 10", "DirectX 11", null,
        '["battle-royale","shooter","free-to-play","multiplayer"]'
      ],
      [
        "valorant", "Valorant", "Shooter", "Riot Games", "Riot Games", "2020-06-02", "Unreal Engine 4",
        "intel-core2duo-e8400", "igpu-intel-uhd630", 4, 20, "Windows 10", "DirectX 11", null,
        "intel-i3-4150", "nvidia-gtx1050-ti", 8, 20, "Windows 10", "DirectX 11", null,
        '["fps","shooter","competitive","free-to-play","multiplayer"]'
      ],
      [
        "overwatch-2", "Overwatch 2", "Shooter", "Blizzard Entertainment", "Blizzard Entertainment", "2022-10-04", "Custom",
        "intel-core2duo-e6600", "nvidia-geforce-gtx600", 4, 50, "Windows 10", "DirectX 11", null,
        "intel-i5-10400", "nvidia-gtx1060-6gb", 8, 50, "Windows 10", "DirectX 11", null,
        '["fps","shooter","hero-shooter","multiplayer","free-to-play"]'
      ],
      [
        "palworld", "Palworld", "Survival", "Pocketpair", "Pocketpair", "2024-01-19", "Unreal Engine 5",
        "intel-i5-10400", "nvidia-rtx2060", 16, 40, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3070", 32, 40, "Windows 10", "DirectX 12", null,
        '["survival","open-world","multiplayer","creature-collection"]'
      ],
      [
        "helldivers-2", "Helldivers 2", "Shooter", "Arrowhead Game Studios", "Sony Interactive", "2024-02-08", "Custom",
        "intel-i7-4790k", "nvidia-gtx1050-ti", 8, 100, "Windows 10", "DirectX 11", null,
        "intel-i7-9700k", "nvidia-rtx2060", 16, 100, "Windows 10", "DirectX 11", null,
        '["shooter","co-op","multiplayer","sci-fi"]'
      ],
      [
        "spider-man-remastered", "Marvel's Spider-Man Remastered", "Action", "Insomniac Games", "Sony Interactive", "2022-08-12", "Insomniac Engine",
        "intel-i3-4130", "nvidia-gtx780", 8, 75, "Windows 10", "DirectX 12", null,
        "intel-i5-4670k", "nvidia-rtx2070-super", 16, 75, "Windows 10", "DirectX 12", null,
        '["action","open-world","superhero","adventure"]'
      ],
      [
        "assassins-creed-mirage", "Assassin's Creed Mirage", "Action", "Ubisoft Bordeaux", "Ubisoft", "2023-10-05", "Anvil",
        "intel-i5-4460", "nvidia-gtx1060-6gb", 8, 40, "Windows 10", "DirectX 12", null,
        "intel-i7-4790k", "nvidia-rtx2070", 16, 40, "Windows 10", "DirectX 12", null,
        '["action","adventure","open-world","stealth"]'
      ],
      [
        "alan-wake-2", "Alan Wake 2", "Horror", "Remedy Entertainment", "Epic Games Publishing", "2023-10-27", "Northlight Engine",
        "intel-i5-7600k", "nvidia-gtx1070", 16, 90, "Windows 10", "DirectX 12", "SSD recommended",
        "intel-i7-13700k", "nvidia-rtx4070", 16, 90, "Windows 10", "DirectX 12", "SSD required",
        '["horror","action","thriller","mystery"]'
      ],
      [
        "stalker-2", "S.T.A.L.K.E.R. 2: Heart of Chornobyl", "FPS", "GSC Game World", "GSC Game World", "2024-11-20", "Unreal Engine 5",
        "intel-i7-9700k", "nvidia-rtx2060", 16, 150, "Windows 10", "DirectX 12", "SSD required",
        "intel-i7-13700k", "nvidia-rtx4070-ti", 32, 150, "Windows 10", "DirectX 12", "SSD required",
        '["fps","open-world","survival","horror","post-apocalyptic"]'
      ],
      [
        "league-of-legends", "League of Legends", "MOBA", "Riot Games", "Riot Games", "2009-10-27", "Custom",
        "intel-core2duo-e8400", "igpu-intel-uhd630", 2, 16, "Windows 10", "DirectX 9", null,
        "intel-i3-4130", "nvidia-gtx1050-ti", 4, 16, "Windows 10", "DirectX 11", null,
        '["moba","competitive","free-to-play","multiplayer"]'
      ],
      [
        "world-of-warcraft", "World of Warcraft", "MMO", "Blizzard Entertainment", "Blizzard Entertainment", "2004-11-23", "Custom",
        "intel-core2duo-e6600", "nvidia-geforce-gtx600", 4, 100, "Windows 10", "DirectX 11", null,
        "intel-i5-10400", "nvidia-rtx2060", 16, 100, "Windows 10", "DirectX 12", null,
        '["mmorpg","mmo","fantasy","multiplayer"]'
      ],
      [
        "cyberpunk-2077-phantom-liberty", "Cyberpunk 2077: Phantom Liberty", "RPG", "CD Projekt Red", "CD Projekt", "2023-09-26", "REDengine 4",
        "intel-i7-6700k", "nvidia-gtx1060-6gb", 16, 70, "Windows 10", "DirectX 12", "SSD required",
        "intel-i7-12700k", "nvidia-rtx3080", 16, 70, "Windows 10", "DirectX 12", "SSD required",
        '["open-world","sci-fi","fps","rpg","dlc"]'
      ],
      [
        "forza-horizon-5", "Forza Horizon 5", "Racing", "Playground Games", "Xbox Game Studios", "2021-11-09", "ForzaTech",
        "intel-i3-4170", "nvidia-gtx760", 8, 110, "Windows 10", "DirectX 12", null,
        "intel-i7-9700k", "nvidia-rtx3070", 16, 110, "Windows 10", "DirectX 12", null,
        '["racing","open-world","multiplayer","simulation"]'
      ],
    ];

    for (const g of gameData) {
      insertGame.run(...g);
    }
  });

  seedAll();
}
