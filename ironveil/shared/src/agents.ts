export interface AbilityDef {
  id: string;
  name: string;
  key: "Q" | "E";
  cd: number;
  desc: string;
}

export interface AgentDef {
  id: number;
  name: string;
  role: string;
  color: number;
  q: AbilityDef;
  e: AbilityDef;
}

export const AGENTS: AgentDef[] = [
  {
    id: 0, name: "NYX", role: "Initiator", color: 0x8fd0ff,
    q: { id: "pulseScan", name: "Pulse Scan", key: "Q", cd: 28, desc: "Reveal enemies within 16m for 4s." },
    e: { id: "silentStep", name: "Silent Step", key: "E", cd: 22, desc: "Silent, 15% faster movement for 6s." },
  },
  {
    id: 1, name: "KILN", role: "Sentinel", color: 0xffb02e,
    q: { id: "barrierWall", name: "Aegis Wall", key: "Q", cd: 30, desc: "Deploy a destructible energy wall (250 HP, 8s)." },
    e: { id: "fortify", name: "Fortify", key: "E", cd: 25, desc: "Gain 50 armor instantly." },
  },
  {
    id: 2, name: "ZEPHYR", role: "Duelist", color: 0xb48cff,
    q: { id: "slipstream", name: "Slipstream", key: "Q", cd: 10, desc: "Dash rapidly in your move direction. 2 charges." },
    e: { id: "updraft", name: "Updraft", key: "E", cd: 14, desc: "Launch upward with a burst of wind." },
  },
  {
    id: 3, name: "LUMEN", role: "Support", color: 0x7dffc8,
    q: { id: "solaceField", name: "Solace Field", key: "Q", cd: 32, desc: "Healing zone that restores 9 HP/s for 6s." },
    e: { id: "flare", name: "Radiant Flare", key: "E", cd: 26, desc: "Blind enemies looking at you for up to 1.7s." },
  },
];

export function agentById(id: number): AgentDef {
  return AGENTS[id] ?? AGENTS[0];
}
