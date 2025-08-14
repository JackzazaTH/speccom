
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Upload, Plus, Trash2, Edit, HardDrive, Cpu, MemoryStick, Gpu, HardDrive as StorageIcon, Power, Monitor, Wrench, CaseSensitive, Download, FileUp, Save, ListChecks, ShoppingCart, CheckCircle2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

/**
 * PC Builder Pro — single-file React app
 * - Inventory (CRUD) with price & stock
 * - Excel import (xlsx/csv) with smart column mapping
 * - Compatibility engine (CPU-MB socket, RAM type, cooler socket, PSU wattage, case form factor, storage interface)
 * - Builder workspace with live compatibility hints
 * - Summary with total price, stock check, export/copy/print
 * - Persistent via localStorage
 * Styling: Tailwind (+ minimal UI), Animations: Framer Motion
 */

// ===== Types =====
const CATEGORIES = [
  "CPU",
  "Motherboard",
  "GPU",
  "RAM",
  "Storage",
  "PSU",
  "Case",
  "Cooler",
] as const;

type Category = typeof CATEGORIES[number];

export type Product = {
  id: string;
  name: string;
  category: Category;
  price: number; // THB
  stock: number;
  attributes: Record<string, any>; // flexible schema
};

// ===== Utilities =====
const uid = () => Math.random().toString(36).slice(2, 10);
const baht = (n: number) => n.toLocaleString("th-TH", { style: "currency", currency: "THB" });

const STORAGE_KEYS = {
  inventory: "pcbuilder.inventory.v1",
  build: "pcbuilder.build.v1",
} as const;

// Sensible defaults for demo
const DEMO_DATA: Product[] = [
  { id: uid(), name: "AMD Ryzen 5 7600", category: "CPU", price: 7490, stock: 8, attributes: { socket: "AM5", tdp: 65 } },
  { id: uid(), name: "Intel Core i5-13400F", category: "CPU", price: 6990, stock: 12, attributes: { socket: "LGA1700", tdp: 148 } },

  { id: uid(), name: "ASUS TUF B650-PLUS", category: "Motherboard", price: 7290, stock: 6, attributes: { socket: "AM5", ramType: "DDR5", formFactor: "ATX", pcieSlots: 2, storage: ["M.2 NVMe", "SATA"] } },
  { id: uid(), name: "MSI PRO B760M-A", category: "Motherboard", price: 4990, stock: 9, attributes: { socket: "LGA1700", ramType: "DDR5", formFactor: "mATX", pcieSlots: 2, storage: ["M.2 NVMe", "SATA"] } },

  { id: uid(), name: "NVIDIA RTX 4070 SUPER", category: "GPU", price: 19990, stock: 4, attributes: { tdp: 220, interface: "PCIe" } },
  { id: uid(), name: "MSI GTX 1660 SUPER", category: "GPU", price: 6990, stock: 5, attributes: { tdp: 125, interface: "PCIe" } },

  { id: uid(), name: "Kingston Fury 16GB (2x8) 6000 DDR5", category: "RAM", price: 2190, stock: 15, attributes: { type: "DDR5", sizeGB: 16 } },
  { id: uid(), name: "Corsair Vengeance 32GB (2x16) 3200 DDR4", category: "RAM", price: 2690, stock: 10, attributes: { type: "DDR4", sizeGB: 32 } },

  { id: uid(), name: "WD Black SN770 1TB NVMe", category: "Storage", price: 2990, stock: 18, attributes: { interface: "M.2 NVMe" } },
  { id: uid(), name: "Seagate Barracuda 2TB SATA", category: "Storage", price: 1690, stock: 8, attributes: { interface: "SATA" } },

  { id: uid(), name: "Corsair RM750", category: "PSU", price: 3290, stock: 7, attributes: { wattage: 750 } },
  { id: uid(), name: "Antec NeoECO 550", category: "PSU", price: 1890, stock: 11, attributes: { wattage: 550 } },

  { id: uid(), name: "NZXT H5 Flow", category: "Case", price: 3590, stock: 3, attributes: { formFactorSupport: ["ATX", "mATX", "ITX"] } },
  { id: uid(), name: "Cooler Master NR200", category: "Case", price: 3290, stock: 5, attributes: { formFactorSupport: ["ITX"] } },

  { id: uid(), name: "DeepCool AK400", category: "Cooler", price: 1190, stock: 9, attributes: { socketSupport: ["AM5", "LGA1700"] } },
  { id: uid(), name: "NZXT Kraken 240", category: "Cooler", price: 4490, stock: 4, attributes: { socketSupport: ["AM5", "LGA1700"] } },
];

// ===== Local Storage Hooks =====
function useLocalStorage<T>(key: string, init: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch (e) {
      return init;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

// ===== Compatibility Engine =====
function estimateWattage(parts: Partial<Record<Category, Product>>): number {
  const cpu = parts["CPU"]?.attributes?.tdp || 0;
  const gpu = parts["GPU"]?.attributes?.tdp || 0;
  // 100W headroom for other parts
  return cpu + gpu + 100;
}

function checkCompatibility(parts: Partial<Record<Category, Product>>) {
  const notes: { level: "ok" | "warn" | "error"; msg: string }[] = [];
  const cpu = parts["CPU"];
  const mb = parts["Motherboard"];
  const ram = parts["RAM"];
  const gpu = parts["GPU"];
  const psu = parts["PSU"];
  const cooler = parts["Cooler"];
  const pcCase = parts["Case"];
  const storage = parts["Storage"];

  if (cpu && mb) {
    if (cpu.attributes.socket !== mb.attributes.socket) {
      notes.push({ level: "error", msg: `CPU socket (${cpu.attributes.socket}) ไม่ตรงกับเมนบอร์ด (${mb.attributes.socket})` });
    } else {
      notes.push({ level: "ok", msg: "CPU ✔ เมนบอร์ด ✔ (ซ็อกเก็ตตรงกัน)" });
    }
  }

  if (ram && mb) {
    if (ram.attributes.type !== mb.attributes.ramType) {
      notes.push({ level: "error", msg: `RAM (${ram.attributes.type}) ไม่ตรงกับเมนบอร์ด (${mb.attributes.ramType})` });
    } else {
      notes.push({ level: "ok", msg: "RAM ✔ เมนบอร์ด ✔ (ชนิดแรมตรงกัน)" });
    }
  }

  if (gpu && mb) {
    if (!mb.attributes.pcieSlots) {
      notes.push({ level: "error", msg: "เมนบอร์ดนี้ไม่มีสล็อต PCIe สำหรับการ์ดจอ" });
    } else {
      notes.push({ level: "ok", msg: "GPU ✔ เมนบอร์ด ✔ (มีสล็อต PCIe)" });
    }
  }

  if (pcCase && mb) {
    const ok = (pcCase.attributes.formFactorSupport || []).includes(mb.attributes.formFactor);
    if (!ok) {
      notes.push({ level: "error", msg: `เคสรองรับ ${pcCase.attributes.formFactorSupport?.join(", ") || "-"} ไม่ตรงกับเมนบอร์ด (${mb.attributes.formFactor})` });
    } else {
      notes.push({ level: "ok", msg: "เคส ✔ เมนบอร์ด ✔ (ขนาดตรงกัน)" });
    }
  }

  if (cooler && cpu) {
    const ok = (cooler.attributes.socketSupport || []).includes(cpu.attributes.socket);
    if (!ok) {
      notes.push({ level: "error", msg: `ชุดระบายความร้อนไม่รองรับซ็อกเก็ต CPU (${cpu.attributes.socket})` });
    } else {
      notes.push({ level: "ok", msg: "คูลเลอร์ ✔ CPU ✔ (รองรับซ็อกเก็ต)" });
    }
  }

  if (storage && mb) {
    if (storage.attributes.interface && mb.attributes.storage) {
      const ok = (mb.attributes.storage as string[]).includes(storage.attributes.interface);
      if (!ok) notes.push({ level: "error", msg: `สตอเรจ (${storage.attributes.interface}) ไม่ตรงกับพอร์ตบนเมนบอร์ด (${(mb.attributes.storage || []).join(", ")})` });
      else notes.push({ level: "ok", msg: "สตอเรจ ✔ เมนบอร์ด ✔ (อินเทอร์เฟซตรงกัน)" });
    }
  }

  if (psu) {
    const need = estimateWattage(parts);
    const has = psu.attributes.wattage || 0;
    if (has < need) notes.push({ level: "warn", msg: `กำลังไฟ PSU ${has}W อาจไม่พอ ต้องการอย่างน้อย ~${need}W` });
    else notes.push({ level: "ok", msg: `PSU เพียงพอ (ต้องการ ~${need}W)` });
  }

  const level = notes.some(n => n.level === "error") ? "error" : notes.some(n => n.level === "warn") ? "warn" : "ok";
  return { level, notes } as const;
}

// ===== Excel Import =====
const normalizeHeader = (s: string) => s.toLowerCase().replace(/\\s+/g, "").replace(/[^a-z0-9]/g, "");

function parseWorkbookToProducts(file: File): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const out: Product[] = [];
        for (const row of json) {
          const keys = Object.keys(row);
          const map: Record<string, any> = {};
          keys.forEach(k => (map[normalizeHeader(k)] = row[k]));

          const rawCategory = (map["category"] || map["หมวดหมู่"] || map["type"]) + "";
          const category = (CATEGORIES.find(c => c.toLowerCase() === (rawCategory || '').toLowerCase()) || "CPU") as Category;
          const name = (map["name"] || map["สินค้า"] || map["product"] || "Unnamed") + "";
          const price = Number(map["price"] || map["ราคา"] || 0);
          const stock = Number(map["stock"] || map["คงเหลือ"] || map["จำนวน"] || 0);

          // Known attribute aliases
          const attributes: Record<string, any> = {};
          const aliasPairs: Record<string, string[]> = {
            socket: ["socket", "ซ็อกเก็ต"],
            tdp: ["tdp"],
            ramType: ["ramtype", "แรม", "ram"],
            formFactor: ["formfactor", "ขนาด"],
            formFactorSupport: ["formfactorsupport", "รองรับเมนบอร์ด"],
            pcieSlots: ["pcieslots"],
            interface: ["interface", "อินเทอร์เฟซ"],
            storage: ["storage", "พอร์ตเก็บข้อมูล"],
            wattage: ["wattage", "กำลังไฟ", "w"] ,
            sizeGB: ["sizegb", "ขนาดgb", "ความจุ"],
            socketSupport: ["socketsupport", "รองรับซ็อกเก็ต"],
          };
          for (const [key, aliases] of Object.entries(aliasPairs)) {
            for (const a of aliases) {
              const v = map[normalizeHeader(a)];
              if (v !== undefined && v !== "") {
                // split lists like "ATX,mATX,ITX"
                if (typeof v === "string" && v.includes(",")) {
                  attributes[key] = v.split(",").map(s => s.trim());
                } else {
                  attributes[key] = isNaN(Number(v)) ? v : Number(v);
                }
                break;
              }
            }
          }

          // If an "attributes" JSON/text column exists, merge it
          const attrRaw = map["attributes"]; 
          if (attrRaw) {
            try {
              const extra = typeof attrRaw === "string" ? JSON.parse(attrRaw) : attrRaw;
              Object.assign(attributes, extra);
            } catch {}
          }

          out.push({ id: uid(), name, category, price, stock, attributes });
        }
        resolve(out);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ===== UI Helpers =====

const categoryIcon: Record<Category, React.ReactNode> = {
  CPU: <Cpu className="w-4 h-4" />, 
  Motherboard: <HardDrive className="w-4 h-4" />, 
  GPU: <Gpu className="w-4 h-4" />, 
  RAM: <MemoryStick className="w-4 h-4" />, 
  Storage: <StorageIcon className="w-4 h-4" />, 
  PSU: <Power className="w-4 h-4" />, 
  Case: <CaseSensitive className="w-4 h-4" />, 
  Cooler: <Wrench className="w-4 h-4" />,
};

function InventoryTable({ items, onEdit, onDelete }: { items: Product[]; onEdit: (p: Product) => void; onDelete: (id: string) => void }) {
  return (
    <div className="border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-12 bg-muted/50 px-4 py-2 text-sm font-semibold">
        <div className="col-span-4">สินค้า</div>
        <div className="col-span-2">หมวด</div>
        <div className="col-span-2 text-right">ราคา</div>
        <div className="col-span-1 text-right">สต็อก</div>
        <div className="col-span-3 text-right">จัดการ</div>
      </div>
      <ScrollArea className="max-h-[360px]">
        {items.map((p) => (
          <div key={p.id} className="grid grid-cols-12 items-center px-4 py-2 border-t hover:bg-muted/30 text-sm">
            <div className="col-span-4 truncate flex items-center gap-2">
              <Badge variant="secondary" className="rounded-xl">
                {categoryIcon[p.category]} <span className="ml-2">{p.category}</span>
              </Badge>
              <span className="font-medium truncate" title={p.name}>{p.name}</span>
            </div>
            <div className="col-span-2">{(p as any).attributes.socket || (p as any).attributes.type || (p as any).attributes.formFactor || "-"}</div>
            <div className="col-span-2 text-right">{baht(p.price)}</div>
            <div className="col-span-1 text-right">{p.stock}</div>
            <div className="col-span-3 flex justify-end gap-2">
              <Button size="icon" variant="secondary" onClick={() => onEdit(p)} title="แก้ไข">
                <Edit className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="destructive" onClick={() => onDelete(p.id)} title="ลบ">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function ProductEditor({ initial, onSave }: { initial?: Partial<Product>, onSave: (p: Product) => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState<Category>((initial?.category as Category) || "CPU");
  const [price, setPrice] = useState<number>(Number(initial?.price || 0));
  const [stock, setStock] = useState<number>(Number(initial?.stock || 0));
  const [attributes, setAttributes] = useState<string>(
    initial?.attributes ? JSON.stringify(initial.attributes, null, 2) : "{}"
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>ชื่อสินค้า</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Ryzen 5 7600" />
        </div>
        <div>
          <Label>หมวดหมู่</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>ราคา (บาท)</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <Label>สต็อก</Label>
          <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
        </div>
      </div>
      <div>
        <Label>คุณสมบัติ (JSON)</Label>
        <textarea className="w-full min-h-40 bg-muted/40 rounded-xl p-3 font-mono text-sm" value={attributes} onChange={e => setAttributes(e.target.value)} />
        <div className="text-xs text-muted-foreground mt-2">
          ตัวอย่าง CPU: {"{\"socket\":\"AM5\",\"tdp\":65}"} | RAM: {"{\"type\":\"DDR5\",\"sizeGB\":32}"}
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => {
          try {
            const attrs = JSON.parse(attributes || "{}");
            onSave({
              id: (initial?.id as string) || uid(),
              name, category, price, stock, attributes: attrs
            } as Product);
          } catch {
            toast.error("JSON Attributes ไม่ถูกต้อง");
          }
        }}>
          <Save className="w-4 h-4 mr-2"/> บันทึกสินค้า
        </Button>
      </div>
    </div>
  );
}

function BuildPicker({
  inventory,
  selection,
  onSelect
}: {
  inventory: Product[];
  selection: Partial<Record<Category, Product>>;
  onSelect: (cat: Category, product: Product | null) => void;
}) {
  const availableByCat = useMemo(() => {
    const map: Record<Category, Product[]> = Object.fromEntries(CATEGORIES.map(c => [c, []])) as any;
    for (const p of inventory) {
      if (p.stock > 0) map[p.category].push(p);
    }
    return map;
  }, [inventory]);

  const comp = useMemo(() => checkCompatibility(selection), [selection]);

  const selectedTotal = Object.values(selection).reduce((sum, p) => sum + (p?.price || 0), 0);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5"/> เลือกอุปกรณ์</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="grid grid-cols-12 items-center gap-2 p-2 rounded-xl hover:bg-muted/40">
              <div className="col-span-4 font-medium flex items-center gap-2">{categoryIcon[cat]} {cat}</div>
              <div className="col-span-8 flex gap-2">
                <Select
                  value={selection[cat]?.id || ""}
                  onValueChange={(id) => {
                    const item = availableByCat[cat].find(p => p.id === id) || null;
                    onSelect(cat, item);
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder={`เลือก ${cat}`} /></SelectTrigger>
                  <SelectContent>
                    {availableByCat[cat].map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {baht(p.price)} {(p.stock <= 3) ? `(เหลือ ${p.stock})` : ''}
                      </SelectItem>
                    ))}
                    {availableByCat[cat].length === 0 && <div className="px-3 py-2 text-muted-foreground">ไม่มีสินค้าในหมวดนี้</div>}
                  </SelectContent>
                </Select>
                {selection[cat] && (
                  <Button variant="secondary" onClick={() => onSelect(cat, null)}>ลบ</Button>
                )}
              </div>
            </div>
          ))}
          <div className="text-right font-semibold">รวมชิ้นส่วน: {baht(selectedTotal)}</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> ความเข้ากันได้</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {comp.notes.map((n, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 ${n.level === 'error' ? 'bg-red-50 text-red-700' : n.level === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {n.level === 'error' ? <AlertTriangle className="w-4 h-4 mt-0.5"/> : n.level === 'warn' ? <AlertTriangle className="w-4 h-4 mt-0.5"/> : <CheckCircle2 className="w-4 h-4 mt-0.5"/>}
                <span>{n.msg}</span>
              </div>
            ))}
            {comp.notes.length === 0 && <div className="text-muted-foreground">เลือกอุปกรณ์เพื่อประเมินความเข้ากันได้</div>}
            <div className="text-sm text-muted-foreground mt-3">ประมาณการกำลังไฟที่ต้องใช้ ~ {estimateWattage(selection)}W</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ selection }: { selection: Partial<Record<Category, Product>> }) {
  const items = CATEGORIES.map(c => selection[c]).filter(Boolean) as Product[];
  const total = items.reduce((s, p) => s + p.price, 0);
  const outOfStock = items.filter(p => p.stock <= 0);

  const handleCopy = async () => {
    const text = [
      "สรุปสเปคคอมพิวเตอร์",
      ...items.map(p => `- ${p.category}: ${p.name} (${baht(p.price)})`),
      `รวมทั้งสิ้น: ${baht(total)}`,
    ].join("\\n");
    try { await navigator.clipboard.writeText(text); toast.success("คัดลอกสรุปแล้ว"); } catch { toast.error("คัดลอกไม่สำเร็จ"); }
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>สรุปสเปค</title>
      <style> body{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; padding:24px;} h1{font-size:20px;} table{width:100%; border-collapse:collapse} td,th{border:1px solid #ddd; padding:8px;} th{background:#f8fafc;text-align:left} tfoot td{font-weight:700}</style>
      </head><body>
        <h1>สรุปสเปคคอมพิวเตอร์</h1>
        <table>
          <thead><tr><th>หมวด</th><th>ชื่อ</th><th>ราคา</th></tr></thead>
          <tbody>
            ${items.map(p => `<tr><td>${p.category}</td><td>${p.name}</td><td style="text-align:right">${baht(p.price)}</td></tr>`).join("")}
          </tbody>
          <tfoot>
            <tr><td colspan="2">รวม</td><td style="text-align:right">${baht(total)}</td></tr>
          </tfoot>
        </table>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> สรุปสเปค & ราคา</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {items.map(p => (
            <div key={p.id} className="flex justify-between bg-muted/30 rounded-xl px-3 py-2">
              <div className="font-medium">{p.category}: <span className="font-normal">{p.name}</span></div>
              <div>{baht(p.price)}</div>
            </div>
          ))}
          {items.length === 0 && <div className="text-muted-foreground">ยังไม่ได้เลือกชิ้นส่วน</div>}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {outOfStock.length > 0 ? <span className="text-red-600">มีสินค้าบางรายการสต็อกไม่พอ</span> : "พร้อมสรุปรายการสั่งซื้อ"}
          </div>
          <div className="font-bold text-xl">รวม: {baht(total)}</div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={handleCopy}><Download className="w-4 h-4 mr-2"/> คัดลอกสรุป</Button>
          <Button onClick={handlePrint}><Download className="w-4 h-4 mr-2"/> พิมพ์/บันทึก PDF</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [inventory, setInventory] = useLocalStorage<Product[]>(STORAGE_KEYS.inventory, DEMO_DATA);
  const [build, setBuild] = useLocalStorage<Partial<Record<Category, Product>>>(STORAGE_KEYS.build, {});
  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState<Product | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(p => [p.name, p.category, JSON.stringify(p.attributes)].join(" ").toLowerCase().includes(q));
  }, [inventory, query]);

  const saveProduct = (p: Product) => {
    setInventory(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = p; else next.unshift(p);
      toast.success(idx >= 0 ? "อัปเดตสินค้าแล้ว" : "เพิ่มสินค้าแล้ว");
      return next;
    });
  };

  const deleteProduct = (id: string) => {
    setInventory(prev => prev.filter(p => p.id !== id));
    toast.success("ลบสินค้าแล้ว");
  };

  const handleImport = async (file: File) => {
    try {
      const items = await parseWorkbookToProducts(file);
      setInventory(prev => [...items, ...prev]);
      toast.success(`นำเข้า ${items.length} รายการสำเร็จ`);
    } catch (e: any) {
      toast.error("นำเข้าล้มเหลว: " + (e?.message || ""));
    }
  };

  const clearAll = () => {
    if (!confirm("ล้างข้อมูลทั้งหมด (คลัง & สเปคที่เลือก)?")) return;
    setInventory(DEMO_DATA);
    setBuild({});
    toast.message("รีเซ็ตเป็นข้อมูลตัวอย่างแล้ว");
  };

  const selectPart = (cat: Category, product: Product | null) => {
    setBuild(prev => ({ ...prev, [cat]: product || undefined }));
  };

  const total = Object.values(build).reduce((s, p) => s + (p?.price || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
        PC Builder Pro — จัดสเปค/จัดการสินค้า (Excel ได้)
      </motion.h1>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">คลังสินค้า</TabsTrigger>
          <TabsTrigger value="builder">จัดสเปค</TabsTrigger>
          <TabsTrigger value="summary">สรุปผล</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="md:col-span-3">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><HardDrive className="w-5 h-5"/> คลังสินค้า</CardTitle>
                <div className="flex items-center gap-2">
                  <Input placeholder="ค้นหา..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-48"/>
                  <Button variant="secondary" onClick={clearAll}>รีเซ็ต</Button>
                </div>
              </CardHeader>
              <CardContent>
                <InventoryTable items={filtered} onEdit={setEditing} onDelete={deleteProduct} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5"/> เพิ่ม/แก้สินค้า</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductEditor onSave={saveProduct} />
                <div className="mt-4 border-t pt-4 space-y-2">
                  <div className="font-semibold flex items-center gap-2"><FileUp className="w-4 h-4"/> นำเข้า Excel / CSV</div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImport(f);
                  }} />
                  <div className="text-xs text-muted-foreground">
                    คอลัมน์ที่รองรับ: Category, Name, Price, Stock, และคอลัมน์คุณสมบัติ เช่น Socket, RAMType, FormFactor, Wattage, Interface, FormFactorSupport (คั่นด้วย ,)
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <BuildPicker inventory={inventory} selection={build} onSelect={selectPart} />
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">เลือกครบแล้วไปหน้า "สรุปผล" ได้เลย</div>
              <div className="font-bold">ราคารวมปัจจุบัน: {baht(total)}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Summary selection={build} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>แก้ไขสินค้า</DialogTitle>
          </DialogHeader>
          {editing && <ProductEditor initial={editing} onSave={(p) => { 
            saveProduct(p); setEditing(null); 
          }} />}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditing(null)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-xs text-muted-foreground mt-6">
        * ระบบนี้เป็นตัวอย่างฝั่ง client (ไม่ต่อฐานข้อมูล) — เก็บข้อมูลในเบราว์เซอร์ของคุณ และรองรับการนำเข้า Excel เพื่อเพิ่มสินค้าอย่างรวดเร็ว
      </div>
    </div>
  );
}
