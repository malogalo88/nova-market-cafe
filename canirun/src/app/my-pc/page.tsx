'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Cpu, Plus, Trash2, Star, Download, Upload, LogIn, Loader2, X } from 'lucide-react';

interface UserPC {
  id: string; name: string; isDefault: boolean; cpuId: string; cpuManufacturer: string;
  cpuModel: string; cpuGeneration: string; cpuCores: number; cpuThreads: number;
  cpuBaseClock: number; cpuBoostClock: number; gpuId: string; gpuManufacturer: string;
  gpuModel: string; gpuIntegrated: boolean; gpuVram: number; gpuVramType: string;
  gpuArchitecture: string; ramTotalGB: number; ramType: string; ramSpeed: number;
  ramSticks: number; storageType: string; storageCapacityGB: number; storageFreeGB: number;
  displayResolution: string; displayRefreshRate: number; osVersion: string; systemType: string;
}

interface HW { id: string; name: string; brand: string; vram?: number; }

function getTier(ram: number, gpu: string) {
  if (ram >= 32 && (gpu.includes('4090') || gpu.includes('5090'))) return 'Excellent';
  if (ram >= 16 && (gpu.includes('4070') || gpu.includes('4080') || gpu.includes('3080') || gpu.includes('7800') || gpu.includes('7900'))) return 'Good';
  if (ram >= 16 && (gpu.includes('4060') || gpu.includes('3060') || gpu.includes('7600'))) return 'Playable';
  if (ram >= 8) return 'Poor';
  return 'Low';
}

function tierColor(t: string) {
  if (t === 'Excellent') return 'text-green';
  if (t === 'Good') return 'text-blue';
  if (t === 'Playable') return 'text-yellow';
  if (t === 'Poor') return 'text-orange';
  return 'text-red';
}

const emptyForm = {
  name: '', cpuId: '', cpuManufacturer: '', cpuModel: '', cpuGeneration: '',
  cpuCores: 0, cpuThreads: 0, cpuBaseClock: 0, cpuBoostClock: 0, cpuArchitecture: '',
  gpuId: '', gpuManufacturer: '', gpuModel: '', gpuIntegrated: false,
  gpuVram: 0, gpuVramType: '', gpuArchitecture: '', gpuDirectX: '',
  ramTotalGB: 16, ramType: 'DDR4', ramSpeed: 3200, ramSticks: 2, ramChannels: 'Dual',
  storageType: 'NVMe', storageCapacityGB: 1024, storageFreeGB: 512,
  displayResolution: '1920x1080', displayRefreshRate: 144, displayAspectRatio: '16:9',
  osVersion: 'Windows 11', osArch: '64-bit', systemType: 'desktop',
  laptopBrand: '', laptopModel: '', batteryInfo: '', isDefault: false,
};

export default function MyPCPage() {
  const { data: session, status } = useSession();
  const [pcs, setPcs] = useState<UserPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPC, setEditingPC] = useState<UserPC | null>(null);
  const [hwList, setHwList] = useState<HW[]>([]);
  const [hwType, setHwType] = useState<'cpu' | 'gpu'>('cpu');
  const [hwSearch, setHwSearch] = useState('');
  const [showHwDrop, setShowHwDrop] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchPCs = useCallback(() => {
    fetch('/api/user-pcs').then(r => r.json()).then(d => { if (Array.isArray(d)) setPcs(d); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isAuth = status === 'authenticated';

  useEffect(() => {
    if (!isAuth) return;
    fetchPCs();
    Promise.all([
      fetch('/api/hardware?type=cpu').then(r => r.json()),
      fetch('/api/hardware?type=gpu').then(r => r.json()),
    ]).then(([c, g]) => {
      if (Array.isArray(c)) setHwList(c);
      if (Array.isArray(g)) setHwList(prev => [...prev, ...g]);
    }).catch(() => {});
  }, [isAuth, fetchPCs]);

  const filteredHw = hwList.filter(h => h.name.toLowerCase().includes(hwSearch.toLowerCase()));

  const selectHw = (h: HW, type: 'cpu' | 'gpu') => {
    if (type === 'cpu') {
      setForm(f => ({ ...f, cpuId: h.id, cpuManufacturer: h.brand, cpuModel: h.name }));
    } else {
      setForm(f => ({ ...f, gpuId: h.id, gpuManufacturer: h.brand, gpuModel: h.name, gpuVram: h.vram || 0 }));
    }
    setHwSearch('');
    setShowHwDrop(false);
  };

  const openForm = (pc?: UserPC) => {
    if (pc) {
      setForm({ ...emptyForm, ...pc });
      setEditingPC(pc);
    } else {
      setForm(emptyForm);
      setEditingPC(null);
    }
    setShowForm(true);
  };

  const saveForm = async () => {
    const url = editingPC ? `/api/user-pcs/${editingPC.id}` : '/api/user-pcs';
    await fetch(url, { method: editingPC ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowForm(false); setEditingPC(null); setForm(emptyForm); fetchPCs();
  };

  const deletePC = async (id: string) => {
    await fetch(`/api/user-pcs/${id}`, { method: 'DELETE' });
    setDelId(null); fetchPCs();
  };

  const setDefault = async (pc: UserPC) => {
    await fetch(`/api/user-pcs/${pc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pc, isDefault: true }) });
    fetchPCs();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(pcs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'canirun-pcs.json'; a.click();
  };

  const importJSON = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text()) as UserPC[];
        for (const pc of data) await fetch('/api/user-pcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pc) });
        fetchPCs();
      } catch { /* */ }
    };
    inp.click();
  };

  if (status === 'loading' || (loading && isAuth)) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  if (!session) return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <Cpu className="mx-auto mb-4 h-16 w-16 text-text-muted/30" />
        <h1 className="mb-2 text-2xl font-bold">My PC Profiles</h1>
        <p className="mb-6 text-text-secondary">Sign in to manage your saved PC configurations.</p>
        <Link href="/auth/signin" className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white"><LogIn className="h-5 w-5" /> Sign In</Link>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My PC Profiles</h1>
        <div className="flex gap-2">
          <button onClick={importJSON} className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-card px-3 py-2 text-xs font-medium text-text-secondary hover:border-border-active"><Upload className="h-3.5 w-3.5" /> Import</button>
          <button onClick={exportJSON} disabled={!pcs.length} className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-card px-3 py-2 text-xs font-medium text-text-secondary hover:border-border-active disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export</button>
          <button onClick={() => openForm()} className="btn-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New PC</button>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-accent/30 bg-bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editingPC ? 'Edit PC' : 'Create New PC'}</h2>
            <button onClick={() => { setShowForm(false); setEditingPC(null); }} className="text-text-muted hover:text-text-primary"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">PC Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Gaming PC" className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">System Type</label>
              <select value={form.systemType} onChange={e => setForm(f => ({ ...f, systemType: e.target.value }))} className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                <option value="desktop">Desktop</option><option value="laptop">Laptop</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-bg-input px-3 py-2 text-sm">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="accent-accent" /> Set as default
              </label>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">CPU</label>
              <div className="relative">
                <input value={hwType === 'cpu' ? hwSearch : form.cpuModel} onChange={e => { setHwType('cpu'); setHwSearch(e.target.value); setShowHwDrop(true); }} onFocus={() => { setHwType('cpu'); setShowHwDrop(true); }} placeholder="Search CPU..." className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
                {showHwDrop && hwType === 'cpu' && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                    {filteredHw.filter(h => !h.vram && h.vram !== 0 || hwList.indexOf(h) < 60).slice(0, 30).map(h => (
                      <button key={h.id} onClick={() => selectHw(h, 'cpu')} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-bg-card-hover"><span className="text-text-primary">{h.name}</span></button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">GPU</label>
              <div className="relative">
                <input value={hwType === 'gpu' ? hwSearch : form.gpuModel} onChange={e => { setHwType('gpu'); setHwSearch(e.target.value); setShowHwDrop(true); }} onFocus={() => { setHwType('gpu'); setShowHwDrop(true); }} placeholder="Search GPU..." className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
                {showHwDrop && hwType === 'gpu' && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                    {filteredHw.filter(h => h.vram !== undefined).slice(0, 30).map(h => (
                      <button key={h.id} onClick={() => selectHw(h, 'gpu')} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-bg-card-hover"><span className="text-text-primary">{h.name}</span><span className="text-xs text-text-muted">{h.vram}GB</span></button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">RAM</label>
              <select value={form.ramTotalGB} onChange={e => setForm(f => ({ ...f, ramTotalGB: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                {[4, 8, 16, 24, 32, 48, 64, 128].map(r => <option key={r} value={r}>{r}GB</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">RAM Type</label>
              <select value={form.ramType} onChange={e => setForm(f => ({ ...f, ramType: e.target.value }))} className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                <option>DDR4</option><option>DDR5</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Storage</label>
              <select value={form.storageType} onChange={e => setForm(f => ({ ...f, storageType: e.target.value }))} className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                <option>NVMe</option><option>SSD</option><option>HDD</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Storage GB</label>
              <input type="number" value={form.storageCapacityGB} onChange={e => setForm(f => ({ ...f, storageCapacityGB: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Resolution</label>
              <select value={form.displayResolution} onChange={e => setForm(f => ({ ...f, displayResolution: e.target.value }))} className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                {['1280x720', '1600x900', '1920x1080', '2560x1440', '3840x2160'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Refresh Rate</label>
              <select value={form.displayRefreshRate} onChange={e => setForm(f => ({ ...f, displayRefreshRate: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                {[60, 75, 120, 144, 165, 240].map(r => <option key={r} value={r}>{r}Hz</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button onClick={saveForm} disabled={!form.name || !form.cpuId || !form.gpuId} className="btn-primary rounded-lg px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              {editingPC ? 'Update PC' : 'Create PC'}
            </button>
          </div>
        </div>
      )}

      {!pcs.length && !showForm ? (
        <div className="py-20 text-center">
          <Cpu className="mx-auto mb-4 h-16 w-16 text-text-muted/30" />
          <h2 className="mb-2 text-xl font-bold">No PCs saved yet</h2>
          <p className="mb-6 text-text-secondary">Create your first PC profile to get started.</p>
          <button onClick={() => openForm()} className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white"><Plus className="h-5 w-5" /> Create Your First PC</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pcs.map(pc => {
            const tier = getTier(pc.ramTotalGB, pc.gpuModel);
            return (
              <div key={pc.id} className={`rounded-xl border bg-bg-card p-5 transition-all hover:border-border-active ${pc.isDefault ? 'border-accent/50 glow-accent' : 'border-border'}`}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-text-primary">{pc.name}</h3>
                    {pc.isDefault && <span className="mt-1 inline-flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent"><Star className="h-2.5 w-2.5" /> DEFAULT</span>}
                  </div>
                  <span className={`text-xs font-bold ${tierColor(tier)}`}>{tier}</span>
                </div>
                <div className="mb-4 space-y-1 text-xs text-text-secondary">
                  <p><span className="text-text-muted">CPU:</span> {pc.cpuModel || 'N/A'}</p>
                  <p><span className="text-text-muted">GPU:</span> {pc.gpuModel || 'N/A'} ({pc.gpuVram}GB)</p>
                  <p><span className="text-text-muted">RAM:</span> {pc.ramTotalGB}GB {pc.ramType}</p>
                  <p><span className="text-text-muted">Storage:</span> {pc.storageCapacityGB}GB {pc.storageType}</p>
                  <p><span className="text-text-muted">Display:</span> {pc.displayResolution} @ {pc.displayRefreshRate}Hz</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/run" className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20">Check Games</Link>
                  {!pc.isDefault && <button onClick={() => setDefault(pc)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:border-border-active">Set Default</button>}
                  <button onClick={() => openForm(pc)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:border-border-active">Edit</button>
                  {delId === pc.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => deletePC(pc.id)} className="rounded-lg bg-red/20 px-2 py-1.5 text-xs font-bold text-red">Yes</button>
                      <button onClick={() => setDelId(null)} className="rounded-lg border border-border px-2 py-1.5 text-xs text-text-muted">No</button>
                    </div>
                  ) : <button onClick={() => setDelId(pc.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-red hover:bg-red/10"><Trash2 className="inline h-3 w-3" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
