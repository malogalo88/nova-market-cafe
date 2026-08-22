import Database from "better-sqlite3";

export function seedNewGames(db: Database.Database): void {
  const existing = db.prepare("SELECT COUNT(*) as count FROM games WHERE id = ?").get("dota-2") as { count: number } | undefined;
  if (existing && existing.count > 0) return;

  const insertGame = db.prepare(`
    INSERT OR IGNORE INTO games (
      id, title, genre, developer, publisher, releaseDate, engine,
      minCpuId, minGpuId, minRamGB, minStorageGB, minOs, minDirectX, minNotes,
      recCpuId, recGpuId, recRamGB, recStorageGB, recOs, recDirectX, recNotes,
      tags, freeToPlay, multiplayer, singlePlayer, controllerSupport, lowEndFriendly, aaa, platforms
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const seedAll = db.transaction(() => {
    const games: [string, string, string, string, string, string, string, string, string, number, number, string, string | null, string | null, string, string, number, number, string, string | null, string | null, string, number, number, number, number, number, number, string][] = [
      // ── Competitive Games ──────────────────────────────────────────
      [
        "dota-2", "Dota 2", "MOBA", "Valve", "Valve", "2013-07-09", "Source 2",
        "intel-i3-12100", "igpu-intel-uhd730", 4, 15, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-gtx1060-6gb", 8, 15, "Windows 10", "DirectX 11", null,
        '["moba","competitive","free-to-play","multiplayer","strategy"]',
        1, 1, 1, 1, 1, 0, '["Windows","Linux","macOS"]',
      ],
      [
        "rocket-league", "Rocket League", "Sports", "Psyonix", "Epic Games", "2015-07-07", "Unreal Engine 3",
        "intel-i3-12100", "igpu-intel-uhd730", 4, 8, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-gtx1060-6gb", 8, 8, "Windows 10", "DirectX 11", null,
        '["sports","competitive","free-to-play","multiplayer","racing"]',
        1, 1, 1, 1, 1, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch"]',
      ],
      [
        "rainbow-six-siege", "Tom Clancy's Rainbow Six Siege", "FPS", "Ubisoft Montreal", "Ubisoft", "2015-12-01", "AnvilNext 2.0",
        "intel-i5-3470", "nvidia-gtx660", 6, 65, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-rtx2060", 16, 65, "Windows 10", "DirectX 12", null,
        '["fps","tactical","competitive","multiplayer","military"]',
        0, 1, 1, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S"]',
      ],
      [
        "pubg-battlegrounds", "PUBG: Battlegrounds", "Battle Royale", "Krafton", "Krafton", "2017-12-20", "Unreal Engine 4",
        "intel-i5-4460", "nvidia-gtx960", 8, 40, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-rtx2060", 16, 40, "Windows 10", "DirectX 12", null,
        '["battle-royale","shooter","multiplayer","survival"]',
        0, 1, 1, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Android","iOS"]',
      ],
      [
        "street-fighter-6", "Street Fighter 6", "Fighting", "Capcom", "Capcom", "2023-06-02", "RE Engine",
        "intel-i5-10400", "nvidia-gtx1060-6gb", 16, 60, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx2060", 16, 60, "Windows 10", "DirectX 12", null,
        '["fighting","competitive","multiplayer","action"]',
        0, 1, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5","Xbox Series X/S"]',
      ],
      [
        "tekken-8", "Tekken 8", "Fighting", "Bandai Namco Studios", "Bandai Namco", "2024-01-26", "Unreal Engine 5",
        "intel-i5-10400", "nvidia-gtx1060-6gb", 16, 100, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx2070", 16, 100, "Windows 10", "DirectX 12", null,
        '["fighting","competitive","multiplayer","action"]',
        0, 1, 1, 1, 0, 1, '["Windows","PlayStation 5","Xbox Series X/S"]',
      ],

      // ── AAA Games ──────────────────────────────────────────────────
      [
        "gta-vi", "Grand Theft Auto VI", "Action", "Rockstar North", "Rockstar Games", "2025-10-10", "RAGE",
        "intel-i5-12400", "nvidia-rtx3060", 16, 150, "Windows 10", "DirectX 12", "SSD required",
        "intel-i7-13700k", "nvidia-rtx4080", 32, 150, "Windows 10", "DirectX 12", "SSD required",
        '["open-world","action","sandbox","multiplayer","crime"]',
        0, 1, 1, 1, 0, 1, '["PlayStation 5","Xbox Series X/S","Windows"]',
      ],
      [
        "god-of-war-2018", "God of War", "Action", "Santa Monica Studio", "Sony Interactive", "2022-01-14", "Custom",
        "intel-i5-2500k", "nvidia-gtx960", 8, 70, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-rtx2060", 8, 70, "Windows 10", "DirectX 12", null,
        '["action","adventure","mythology","singleplayer"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4"]',
      ],
      [
        "god-of-war-ragnarok", "God of War Ragnarök", "Action", "Santa Monica Studio", "Sony Interactive", "2024-09-19", "Custom",
        "intel-i5-10400", "nvidia-rtx2060", 16, 190, "Windows 10", "DirectX 12", "SSD recommended",
        "intel-i7-12700k", "nvidia-rtx3070", 16, 190, "Windows 10", "DirectX 12", "SSD recommended",
        '["action","adventure","mythology","singleplayer","norse"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5"]',
      ],
      [
        "horizon-forbidden-west", "Horizon Forbidden West", "Action", "Guerrilla Games", "Sony Interactive", "2024-03-21", "Decima",
        "intel-i5-10400", "nvidia-rtx2060", 16, 100, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3070", 16, 100, "Windows 10", "DirectX 12", null,
        '["action","open-world","adventure","sci-fi","singleplayer"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5"]',
      ],
      [
        "spider-man-miles-morales", "Marvel's Spider-Man: Miles Morales", "Action", "Insomniac Games", "Sony Interactive", "2022-11-18", "Insomniac Engine",
        "intel-i5-10400", "nvidia-gtx1060-6gb", 8, 75, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3070", 16, 75, "Windows 10", "DirectX 12", null,
        '["action","open-world","superhero","adventure","singleplayer"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5"]',
      ],
      [
        "the-last-of-us-part-i", "The Last of Us Part I", "Action", "Naughty Dog", "Sony Interactive", "2023-03-28", "Proprietary",
        "intel-i5-10400", "nvidia-gtx1660-ti", 16, 100, "Windows 10", "DirectX 12", "SSD recommended",
        "intel-i7-12700k", "nvidia-rtx3070", 16, 100, "Windows 10", "DirectX 12", "SSD recommended",
        '["action","adventure","horror","singleplayer","post-apocalyptic"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 5"]',
      ],
      [
        "assassins-creed-valhalla", "Assassin's Creed Valhalla", "Action", "Ubisoft Montreal", "Ubisoft", "2020-11-10", "Anvil",
        "intel-i5-4460", "nvidia-gtx1060-6gb", 8, 50, "Windows 10", "DirectX 12", null,
        "intel-i7-4790k", "nvidia-rtx2070", 8, 50, "Windows 10", "DirectX 12", null,
        '["action","open-world","rpg","viking","stealth"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S"]',
      ],
      [
        "assassins-creed-shadows", "Assassin's Creed Shadows", "Action", "Ubisoft Quebec", "Ubisoft", "2025-03-20", "Anvil",
        "intel-i5-10400", "nvidia-rtx2060", 16, 65, "Windows 10", "DirectX 12", "SSD recommended",
        "intel-i7-13700k", "nvidia-rtx4070", 16, 65, "Windows 10", "DirectX 12", "SSD recommended",
        '["action","open-world","rpg","stealth","samurai"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 5","Xbox Series X/S"]',
      ],
      [
        "final-fantasy-xvi", "Final Fantasy XVI", "RPG", "Square Enix Creative Business Unit III", "Square Enix", "2024-09-17", "Custom",
        "intel-i5-10400", "nvidia-rtx2060", 16, 90, "Windows 10", "DirectX 12", "SSD required",
        "intel-i7-13700k", "nvidia-rtx4070", 16, 90, "Windows 10", "DirectX 12", "SSD required",
        '["rpg","action","fantasy","singleplayer","j-rpg"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 5"]',
      ],
      [
        "final-fantasy-vii-rebirth", "Final Fantasy VII Rebirth", "RPG", "Square Enix Creative Business Unit I", "Square Enix", "2025-05-29", "Unreal Engine 5",
        "intel-i5-12400", "nvidia-rtx2060", 16, 100, "Windows 10", "DirectX 12", "SSD required",
        "intel-i7-12700k", "nvidia-rtx3070", 16, 100, "Windows 10", "DirectX 12", "SSD required",
        '["rpg","action","fantasy","singleplayer","j-rpg"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 5"]',
      ],
      [
        "ghost-of-tsushima", "Ghost of Tsushima", "Action", "Sucker Punch Productions", "Sony Interactive", "2024-05-16", "Sucker Punch Engine",
        "intel-i5-10400", "nvidia-rtx2060", 16, 75, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3070", 16, 75, "Windows 10", "DirectX 12", null,
        '["action","open-world","adventure","samurai","singleplayer"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5"]',
      ],
      [
        "detroit-become-human", "Detroit: Become Human", "Adventure", "Quantic Dream", "Quantic Dream", "2019-06-12", "Quantic Dream Engine",
        "intel-i5-3470", "nvidia-gtx660", 4, 50, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-rtx2060", 8, 50, "Windows 10", "DirectX 12", null,
        '["adventure","story-rich","narrative","singleplayer","sci-fi"]',
        0, 0, 1, 1, 0, 0, '["Windows","PlayStation 4"]',
      ],
      [
        "death-stranding", "Death Stranding", "Action", "Kojima Productions", "505 Games", "2019-11-08", "Decima",
        "intel-i5-3470", "nvidia-gtx1060-6gb", 8, 80, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-rtx2060", 16, 80, "Windows 10", "DirectX 12", null,
        '["action","open-world","adventure","singleplayer","sci-fi"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5","Xbox Series X/S"]',
      ],
      [
        "control", "Control", "Action", "Remedy Entertainment", "505 Games", "2019-08-27", "Northlight Engine",
        "intel-i5-7600k", "nvidia-gtx1060-6gb", 8, 42, "Windows 10", "DirectX 11", null,
        "intel-i7-12700k", "nvidia-rtx2070", 16, 42, "Windows 10", "DirectX 12", null,
        '["action","adventure","supernatural","singleplayer","third-person"]',
        0, 0, 1, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch"]',
      ],
      [
        "metro-exodus", "Metro Exodus", "FPS", "4A Games", "Deep Silver", "2019-02-15", "4A Engine",
        "intel-i5-4460", "nvidia-gtx1060-6gb", 8, 59, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx2070", 8, 59, "Windows 10", "DirectX 12", null,
        '["fps","post-apocalyptic","horror","survival","singleplayer"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S"]',
      ],
      [
        "need-for-speed-unbound", "Need for Speed Unbound", "Racing", "Criterion", "Electronic Arts", "2022-12-02", "Frostbite",
        "intel-i5-8400", "nvidia-gtx1060-6gb", 8, 50, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3060", 16, 50, "Windows 10", "DirectX 12", null,
        '["racing","open-world","multiplayer","cars"]',
        0, 1, 1, 1, 0, 0, '["Windows","PlayStation 5","Xbox Series X/S"]',
      ],
      [
        "uncharted-legacy-of-thieves", "Uncharted: Legacy of Thieves", "Action", "Naughty Dog", "Sony Interactive", "2022-10-19", "Proprietary",
        "intel-i5-10400", "nvidia-gtx1660-ti", 16, 126, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3070", 16, 126, "Windows 10", "DirectX 12", null,
        '["action","adventure","singleplayer","exploration"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 5"]',
      ],
      [
        "a-plague-tale-requiem", "A Plague Tale: Requiem", "Adventure", "Asobo Studio", "Focus Entertainment", "2022-10-18", "Asobo Engine",
        "intel-i5-8400", "nvidia-gtx1060-6gb", 16, 60, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3060", 16, 60, "Windows 10", "DirectX 12", null,
        '["adventure","action","horror","singleplayer","stealth"]',
        0, 0, 1, 1, 0, 0, '["Windows","PlayStation 5","Xbox Series X/S","Nintendo Switch"]',
      ],
      [
        "resident-evil-4-remake", "Resident Evil 4 Remake", "Horror", "Capcom", "Capcom", "2023-03-24", "RE Engine",
        "intel-i5-8400", "nvidia-rtx2060", 16, 60, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3070", 16, 60, "Windows 10", "DirectX 12", null,
        '["horror","action","survival","singleplayer","third-person"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5","Xbox Series X/S"]',
      ],
      [
        "resident-evil-village", "Resident Evil Village", "Horror", "Capcom", "Capcom", "2021-05-07", "RE Engine",
        "intel-i5-8400", "nvidia-gtx1060-6gb", 8, 45, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3060", 16, 45, "Windows 10", "DirectX 12", null,
        '["horror","action","survival","singleplayer","first-person"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S"]',
      ],
      [
        "silent-hill-2-remake", "Silent Hill 2 Remake", "Horror", "Bloober Team", "Konami", "2024-10-08", "Unreal Engine 5",
        "intel-i5-10400", "nvidia-rtx2060", 16, 50, "Windows 10", "DirectX 12", "SSD recommended",
        "intel-i7-13700k", "nvidia-rtx4070", 16, 50, "Windows 10", "DirectX 12", "SSD recommended",
        '["horror","survival","singleplayer","psychological","third-person"]',
        0, 0, 1, 1, 0, 1, '["Windows","PlayStation 5"]',
      ],
      [
        "hitman-world-of-assassination", "Hitman: World of Assassination", "Stealth", "IO Interactive", "IO Interactive", "2021-01-20", "Glacier",
        "intel-i5-2500k", "nvidia-gtx660", 8, 60, "Windows 10", "DirectX 12", null,
        "intel-i5-12400", "nvidia-rtx2060", 16, 60, "Windows 10", "DirectX 12", null,
        '["stealth","action","singleplayer","multiplayer","sandbox"]',
        0, 1, 1, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch"]',
      ],
      [
        "total-war-warhammer-3", "Total War: Warhammer III", "Strategy", "Creative Assembly", "Sega", "2022-02-17", "Warscape",
        "intel-i5-4690k", "nvidia-gtx1660-ti", 8, 120, "Windows 10", "DirectX 11", null,
        "intel-i7-8700k", "nvidia-rtx3060", 16, 120, "Windows 10", "DirectX 12", null,
        '["strategy","turn-based","real-time","fantasy","multiplayer"]',
        0, 1, 1, 0, 0, 1, '["Windows","Linux","macOS"]',
      ],
      [
        "cities-skylines-ii", "Cities: Skylines II", "Simulation", "Colossal Order", "Paradox Interactive", "2023-10-24", "Unity",
        "intel-i5-10400", "nvidia-rtx2060", 16, 60, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3060", 16, 60, "Windows 10", "DirectX 12", null,
        '["simulation","strategy","city-builder","singleplayer"]',
        0, 0, 1, 0, 0, 0, '["Windows","PlayStation 5","Xbox Series X/S"]',
      ],

      // ── Sandbox / Minecraft-like ───────────────────────────────────
      [
        "minecraft-bedrock", "Minecraft: Bedrock Edition", "Sandbox", "Mojang Studios", "Mojang Studios", "2016-12-19", "Bedrock Engine",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 4, 4, "Windows 10", null, null,
        "intel-i5-4690k", "nvidia-gtx1050-ti", 8, 4, "Windows 10", null, "With ray tracing on RTX hardware",
        '["sandbox","survival","creative","multiplayer","cross-platform"]',
        0, 1, 1, 1, 1, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch","Android","iOS"]',
      ],
      [
        "terraria", "Terraria", "Sandbox", "Re-Logic", "Re-Logic", "2011-05-16", "XNA",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 2, 1, "Windows 7", null, null,
        "intel-i3-12100", "nvidia-gtx1050-ti", 4, 1, "Windows 10", null, null,
        '["sandbox","survival","crafting","2d","multiplayer"]',
        0, 1, 1, 1, 1, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch","macOS","Linux"]',
      ],
      [
        "roblox", "Roblox", "Sandbox", "Roblox Corporation", "Roblox Corporation", "2006-09-01", "Roblox Engine",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 4, 2, "Windows 10", null, null,
        "intel-i3-12100", "igpu-intel-uhd730", 8, 2, "Windows 10", null, null,
        '["sandbox","multiplayer","user-generated","creative","free-to-play"]',
        1, 1, 1, 1, 1, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch","Android","iOS"]',
      ],
      [
        "subnautica", "Subnautica", "Survival", "Unknown Worlds Entertainment", "Unknown Worlds", "2018-01-23", "Unity",
        "intel-i5-4690k", "nvidia-gtx960", 4, 20, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-rtx2060", 8, 20, "Windows 10", "DirectX 12", null,
        '["survival","open-world","exploration","singleplayer","underwater"]',
        0, 0, 1, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch"]',
      ],

      // ── FPS / Call of Duty / Halo / Battlefield / DOOM ─────────────
      [
        "cod-warzone", "Call of Duty: Warzone", "FPS", "Infinity Ward", "Activision", "2020-03-10", "IW Engine",
        "intel-i5-3470", "nvidia-gtx1650", 8, 100, "Windows 10", "DirectX 12", null,
        "intel-i7-8700k", "nvidia-rtx2060", 16, 100, "Windows 10", "DirectX 12", null,
        '["fps","battle-royale","shooter","free-to-play","multiplayer","military"]',
        1, 1, 0, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S"]',
      ],
      [
        "cod-black-ops-6", "Call of Duty: Black Ops 6", "FPS", "Treyarch", "Activision", "2024-10-25", "IW Engine",
        "intel-i5-6600k", "nvidia-gtx1050-ti", 8, 125, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3060", 16, 125, "Windows 10", "DirectX 12", null,
        '["fps","shooter","multiplayer","military","zombies"]',
        0, 1, 1, 1, 0, 1, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S"]',
      ],
      [
        "halo-infinite", "Halo Infinite", "FPS", "343 Industries", "Xbox Game Studios", "2021-12-08", "Slipspace Engine",
        "intel-i5-4460", "nvidia-gtx1060-6gb", 8, 75, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx2060", 16, 75, "Windows 10", "DirectX 12", null,
        '["fps","shooter","sci-fi","multiplayer","free-to-play","campaign"]',
        0, 1, 1, 1, 0, 1, '["Windows","Xbox One","Xbox Series X/S"]',
      ],
      [
        "battlefield-2042", "Battlefield 2042", "FPS", "DICE", "Electronic Arts", "2021-11-19", "Frostbite",
        "intel-i5-6600k", "nvidia-gtx1060-6gb", 8, 100, "Windows 10", "DirectX 12", null,
        "intel-i7-12700k", "nvidia-rtx3060", 16, 100, "Windows 10", "DirectX 12", null,
        '["fps","shooter","military","multiplayer","large-scale"]',
        0, 1, 1, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S"]',
      ],
      [
        "doom-eternal", "DOOM Eternal", "FPS", "id Software", "Bethesda Softworks", "2020-03-20", "id Tech 7",
        "intel-i5-3470", "nvidia-gtx1050-ti", 8, 50, "Windows 10", "DirectX 12", null,
        "intel-i5-12400", "nvidia-rtx2060", 8, 50, "Windows 10", "DirectX 12", null,
        '["fps","action","singleplayer","demons","fast-paced"]',
        0, 1, 1, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch"]',
      ],
      [
        "doom-2016", "DOOM (2016)", "FPS", "id Software", "Bethesda Softworks", "2016-05-13", "id Tech 6",
        "intel-i5-2400", "nvidia-gtx670", 8, 45, "Windows 7", "DirectX 11", null,
        "intel-i5-12400", "nvidia-gtx1060-6gb", 8, 45, "Windows 10", "DirectX 11", null,
        '["fps","action","singleplayer","demons","fast-paced"]',
        0, 0, 1, 1, 0, 0, '["Windows","PlayStation 4","Xbox One","Nintendo Switch"]',
      ],
      [
        "left-4-dead-2", "Left 4 Dead 2", "FPS", "Valve", "Valve", "2009-11-17", "Source",
        "intel-core2duo-e6600", "nvidia-gtx660", 2, 13, "Windows 7", "DirectX 9", null,
        "intel-i3-12100", "nvidia-gtx1050-ti", 4, 13, "Windows 10", "DirectX 11", null,
        '["fps","zombie","co-op","multiplayer","survival"]',
        0, 1, 1, 1, 1, 0, '["Windows","Xbox 360"]',
      ],
      [
        "borderlands-3", "Borderlands 3", "FPS", "Gearbox Software", "2K", "2019-09-13", "Unreal Engine 4",
        "intel-i5-4690k", "nvidia-gtx1050-ti", 6, 75, "Windows 7", "DirectX 11", null,
        "intel-i7-12700k", "nvidia-rtx2060", 8, 75, "Windows 10", "DirectX 12", null,
        '["fps","looter-shooter","rpg","co-op","multiplayer","comedy"]',
        0, 1, 1, 1, 0, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","macOS"]',
      ],
      [
        "titanfall-2", "Titanfall 2", "FPS", "Respawn Entertainment", "Electronic Arts", "2016-10-28", "Source Engine",
        "intel-i5-2400", "nvidia-gtx660", 6, 45, "Windows 7", "DirectX 11", null,
        "intel-i5-12400", "nvidia-gtx1060-6gb", 8, 45, "Windows 10", "DirectX 11", null,
        '["fps","action","sci-fi","singleplayer","multiplayer","mechs"]',
        0, 1, 1, 1, 0, 0, '["Windows","PlayStation 4","Xbox One"]',
      ],

      // ── Indie / Lightweight ────────────────────────────────────────
      [
        "hades", "Hades", "Roguelike", "Supergiant Games", "Supergiant Games", "2020-09-17", "Custom",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 4, 15, "Windows 10", "DirectX 11", null,
        "intel-i3-12100", "nvidia-gtx1050-ti", 4, 15, "Windows 10", "DirectX 11", null,
        '["roguelike","action","indie","mythology","singleplayer"]',
        0, 0, 1, 1, 1, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch","macOS"]',
      ],
      [
        "hollow-knight", "Hollow Knight", "Metroidvania", "Team Cherry", "Team Cherry", "2017-02-24", "Unity",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 2, 9, "Windows 7", "DirectX 10", null,
        "intel-i3-12100", "igpu-intel-uhd730", 4, 9, "Windows 10", "DirectX 11", null,
        '["metroidvania","indie","platformer","adventure","singleplayer"]',
        0, 0, 1, 1, 1, 0, '["Windows","PlayStation 4","Xbox One","Nintendo Switch","macOS","Linux"]',
      ],
      [
        "stardew-valley", "Stardew Valley", "Simulation", "ConcernedApe", "ConcernedApe", "2016-02-26", "XNA/MonoGame",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 2, 0.5, "Windows 7", null, "500 MB",
        "intel-i3-12100", "igpu-intel-uhd730", 4, 0.5, "Windows 10", null, "500 MB",
        '["simulation","rpg","farming","indie","multiplayer","cozy"]',
        0, 1, 1, 1, 1, 0, '["Windows","PlayStation 4","Xbox One","Nintendo Switch","iOS","Android","macOS","Linux"]',
      ],
      [
        "celeste", "Celeste", "Platformer", "Maddy Makes Games", "Maddy Makes Games", "2018-01-25", "XNA/MonoGame",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 2, 1.2, "Windows 7", null, "1.2 GB",
        "intel-i3-12100", "igpu-intel-uhd730", 2, 1.2, "Windows 10", null, "1.2 GB",
        '["platformer","indie","difficult","singleplayer","narrative"]',
        0, 0, 1, 1, 1, 0, '["Windows","PlayStation 4","Xbox One","Nintendo Switch","macOS","Linux"]',
      ],
      [
        "cuphead", "Cuphead", "Platformer", "Studio MDHR", "Studio MDHR", "2017-09-29", "Unity",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 2, 4, "Windows 7", "DirectX 10", null,
        "intel-i3-12100", "igpu-intel-uhd730", 3, 4, "Windows 10", "DirectX 11", null,
        '["platformer","run-and-gun","indie","difficult","co-op","singleplayer"]',
        0, 1, 1, 1, 1, 0, '["Windows","PlayStation 4","Xbox One","Nintendo Switch","macOS"]',
      ],
      [
        "undertale", "Undertale", "RPG", "tobyfox", "tobyfox", "2015-09-15", "GameMaker",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 2, 0.2, "Windows XP", null, "200 MB",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 2, 0.2, "Windows XP", null, "200 MB",
        '["rpg","indie","narrative","singleplayer","retro"]',
        0, 0, 1, 1, 1, 0, '["Windows","PlayStation 4","Xbox One","Nintendo Switch","macOS","Linux"]',
      ],
      [
        "among-us", "Among Us", "Party", "Innersloth", "Innersloth", "2018-06-15", "Unity",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 1, 0.25, "Windows 7", null, "250 MB",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 1, 0.25, "Windows 7", null, "250 MB",
        '["party","multiplayer","social-deduction","casual","free-to-play"]',
        1, 1, 1, 1, 1, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch","Android","iOS"]',
      ],
      [
        "vampire-survivors", "Vampire Survivors", "Roguelike", "poncle", "poncle", "2022-12-17", "Custom",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 1, 0.3, "Windows 7", null, "300 MB",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 1, 0.3, "Windows 7", null, "300 MB",
        '["roguelike","bullet-hell","indie","casual","singleplayer","free-to-play"]',
        1, 1, 1, 1, 1, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch","Android","iOS"]',
      ],
      [
        "lethal-company", "Lethal Company", "Horror", "Zeekerss", "Zeekerss", "2023-10-23", "Unity",
        "intel-i3-12100", "nvidia-gtx1050-ti", 4, 1, "Windows 10", "DirectX 11", null,
        "intel-i5-12400", "nvidia-gtx1660-ti", 8, 1, "Windows 10", "DirectX 12", null,
        '["horror","co-op","indie","survival","multiplayer","scifi"]',
        0, 1, 1, 1, 0, 0, '["Windows"]',
      ],
      [
        "balatro", "Balatro", "Roguelike", "LocalThunk", "Playstack", "2024-02-20", "Custom",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 1, 0.15, "Windows 7", null, "150 MB",
        "intel-core2duo-e6600", "igpu-intel-uhd630", 1, 0.15, "Windows 7", null, "150 MB",
        '["roguelike","card-game","indie","casual","singleplayer","poker"]',
        0, 0, 1, 1, 1, 0, '["Windows","PlayStation 4","PlayStation 5","Xbox One","Xbox Series X/S","Nintendo Switch","iOS","Android"]',
      ],
    ];

    for (const g of games) {
      insertGame.run(...g);
    }
  });

  seedAll();
}
