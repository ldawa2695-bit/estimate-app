import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Save,
  Download,
  Printer,
  Trash2,
  Copy,
  Plus,
  Search,
  AlertTriangle,
  X,
  Check,
  FolderOpen,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens — "field survey ledger": blueprint ink on drafting paper,
// with a brass/measuring-tape accent standing in for the one warm highlight.
// ---------------------------------------------------------------------------
const COLORS = {
  ink: "#20242A",
  blueprint: "#1B3A5C",
  blueprintDeep: "#12283F",
  steel: "#5B7591",
  paper: "#EDEAE3",
  paperDark: "#E0DCD2",
  card: "#FCFBF8",
  rust: "#B14A2A",
  green: "#3C7A5D",
  brass: "#B8863B",
  brassLight: "#F1E4C8",
  line: "#CBC4B4",
  lineSoft: "#DEDACE",
};

// Fonts are now loaded directly in index.html's <head> (see public/index.html
// or the project root index.html) so the browser fetches them immediately
// alongside the page, instead of after this JS bundle runs — that late
// @import here used to cause a visible font swap and was the main source
// of the "Poor" CLS/LCP scores. Kept as an empty string so the <style>
// tag below stays harmless if anything still references FONT_IMPORT.
const FONT_IMPORT = ``;

// ---------------------------------------------------------------------------
// Default item library (SAMPLE rates — clearly flagged as editable/illustrative)
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { key: "earthwork", label: "Earthwork", shape: "volume", unit: "m³" },
  { key: "concrete", label: "Concrete Work", shape: "volume", unit: "m³" },
  { key: "masonry", label: "Masonry", shape: "volume", unit: "m³" },
  { key: "reinforcement", label: "Reinforcement", shape: "weight", unit: "kg" },
  { key: "plaster", label: "Plaster & Finishing", shape: "area", unit: "m²" },
  { key: "flooring", label: "Flooring & Tiling", shape: "area", unit: "m²" },
  { key: "doorswindows", label: "Doors & Windows", shape: "count", unit: "Nos" },
  { key: "painting", label: "Painting", shape: "area", unit: "m²" },
  { key: "watersupply", label: "Water Supply & Sanitary", shape: "count", unit: "Nos" },
  { key: "irrigation", label: "Irrigation & Culverts", shape: "volume", unit: "m³" },
];

const DEFAULT_LIBRARY = [
  { id: "ew1", cat: "earthwork", name: "Excavation in ordinary soil (foundation)", rate: 210 },
  { id: "ew2", cat: "earthwork", name: "Backfilling with excavated soil, compacted", rate: 140 },
  { id: "cw1", cat: "concrete", name: "PCC 1:4:8 (foundation/leveling)", rate: 9800 },
  { id: "cw2", cat: "concrete", name: "RCC M20 in column", rate: 16500 },
  { id: "cw3", cat: "concrete", name: "RCC M20 in beam", rate: 16000 },
  { id: "cw4", cat: "concrete", name: "RCC M20 in slab", rate: 15200 },
  { id: "ma1", cat: "masonry", name: "Brick work in cement mortar 1:6 (wall)", rate: 11800 },
  { id: "ma2", cat: "masonry", name: "Stone masonry in cement mortar 1:6 (foundation)", rate: 9200 },
  { id: "rf1", cat: "reinforcement", name: "TMT reinforcement steel, cutting & bending", rate: 165 },
  { id: "pl1", cat: "plaster", name: "Cement plaster 12mm, 1:4, wall", rate: 320 },
  { id: "pl2", cat: "plaster", name: "Cement plaster 15mm, ceiling", rate: 380 },
  { id: "fl1", cat: "flooring", name: "Ceramic tile flooring (600x600mm)", rate: 1450 },
  { id: "fl2", cat: "flooring", name: "Vitrified tile flooring, premium", rate: 1950 },
  { id: "dw1", cat: "doorswindows", name: "Wooden panel door, standard size, with frame", rate: 14500 },
  { id: "dw2", cat: "doorswindows", name: "Aluminium sliding window with glass", rate: 6800 },
  { id: "pt1", cat: "painting", name: "Wall putty + primer + 2 coat paint", rate: 210 },
  { id: "ws1", cat: "watersupply", name: "GI/PPR pipe connection, internal plumbing point", rate: 2200 },
  { id: "ws2", cat: "watersupply", name: "Septic tank (standard household size), complete", rate: 45000 },
  { id: "ws3", cat: "watersupply", name: "Soak pit, complete", rate: 18000 },
  { id: "ws4", cat: "watersupply", name: "Manhole (brick masonry, standard depth)", rate: 8500 },
  { id: "ws5", cat: "watersupply", name: "WC pan with cistern, fixed & connected", rate: 9500 },
  { id: "ir1", cat: "irrigation", name: "Canal lining, PCC 1:2:4, 75mm thick", rate: 3400 },
  { id: "ir2", cat: "irrigation", name: "Slab culvert (RCC, standard span)", rate: 22000 },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n) =>
  (Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function slugify(s) {
  const base = (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return base || `untitled-${Date.now()}`;
}

function shapeFor(cat) {
  return CATEGORIES.find((c) => c.key === cat) || CATEGORIES[0];
}

function computeQty(dims, shape) {
  const L = parseFloat(dims.l) || 0;
  const W = parseFloat(dims.w) || 0;
  const H = parseFloat(dims.h) || 0;
  const N = parseFloat(dims.n) || 0;
  if (shape === "volume") return L * W * H;
  if (shape === "area") return L * W;
  if (shape === "weight") return N;
  if (shape === "count") return N;
  return 0;
}

// ---------------------------------------------------------------------------
// Signature element — a drafting scale bar. Doubles as a section rule and a
// nod to the subject: nothing here is measured without a scale to check it.
// ---------------------------------------------------------------------------
function ScaleBar({ ticks = 24 }) {
  const items = Array.from({ length: ticks });
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "flex-end",
        height: 10,
        overflow: "hidden",
        background: COLORS.blueprintDeep,
      }}
    >
      {items.map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: i % 5 === 0 ? 10 : i % 2 === 0 ? 6 : 4,
            background: i % 10 < 5 ? COLORS.brass : "rgba(241,228,200,0.35)",
            marginRight: 1,
          }}
        />
      ))}
    </div>
  );
}

function ShapeIcon({ shape }) {
  const stroke = COLORS.blueprint;
  if (shape === "volume")
    return (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <path d="M6 12 L17 6 L28 12 L28 24 L17 30 L6 24 Z" stroke={stroke} strokeWidth="1.4" />
        <path d="M6 12 L17 18 L28 12" stroke={stroke} strokeWidth="1.4" />
        <path d="M17 18 L17 30" stroke={stroke} strokeWidth="1.4" />
      </svg>
    );
  if (shape === "area")
    return (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <rect x="6" y="9" width="22" height="16" stroke={stroke} strokeWidth="1.4" />
        <path d="M6 6 H28 M6 6 V9 M28 6 V9" stroke={stroke} strokeWidth="1" />
        <path d="M3 9 V25 M3 9 H6 M3 25 H6" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  if (shape === "weight")
    return (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <circle cx="17" cy="17" r="10" stroke={stroke} strokeWidth="1.4" />
        <path d="M17 10 V24 M10 17 H24" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <rect x="9" y="6" width="16" height="22" rx="1" stroke={stroke} strokeWidth="1.4" />
      <path d="M13 17 h8" stroke={stroke} strokeWidth="1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = "ok") => {
    const id = uid();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return { toasts, push };
}

function ToastStack({ toasts }) {
  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        bottom: 18,
        right: 18,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 60,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.tone === "error" ? COLORS.rust : COLORS.blueprintDeep,
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 5,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 200,
            animation: "toastIn 0.18s ease-out",
          }}
        >
          {t.tone === "error" ? <AlertTriangle size={15} /> : <Check size={15} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const [library, setLibrary] = useState(DEFAULT_LIBRARY);
  const [rows, setRows] = useState([]);
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].key);
  const [dims, setDims] = useState({ l: "", w: "", h: "", n: "" });
  const [pickedItem, setPickedItem] = useState(DEFAULT_LIBRARY[0].id);
  const [projectName, setProjectName] = useState("Untitled Building Estimate");
  const [contingencyPct, setContingencyPct] = useState(3);
  const [vatPct, setVatPct] = useState(13);
  const [savedList, setSavedList] = useState([]);
  const [activeTab, setActiveTab] = useState("boq");
  const [itemQuery, setItemQuery] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemRate, setNewItemRate] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [confirmRemoveSaved, setConfirmRemoveSaved] = useState(null);
  const [savingBusy, setSavingBusy] = useState(false);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const printRef = useRef(null);
  const { toasts, push } = useToasts();

  useEffect(() => {
    const items = library.filter((i) => i.cat === activeCat);
    if (items.length && !items.find((i) => i.id === pickedItem)) {
      setPickedItem(items[0].id);
    }
  }, [activeCat, library]); // eslint-disable-line

  const refreshIndex = useCallback(async () => {
    try {
      const res = await window.storage.get("estimate_index", false);
      const idx = res && res.value ? JSON.parse(res.value) : [];
      setSavedList(idx);
    } catch (e) {
      setSavedList([]);
    }
  }, []);

  useEffect(() => {
    refreshIndex();
  }, [refreshIndex]);

  const catMeta = shapeFor(activeCat);
  const currentItem = library.find((i) => i.id === pickedItem);
  const previewQty = computeQty(dims, catMeta.shape);
  const canAdd = currentItem && previewQty > 0;

  function addRow() {
    if (!currentItem || previewQty <= 0) return;
    setRows((r) => [
      ...r,
      {
        id: uid(),
        cat: activeCat,
        name: currentItem.name,
        unit: catMeta.unit,
        qty: previewQty,
        rate: currentItem.rate,
      },
    ]);
    setDims({ l: "", w: "", h: "", n: "" });
    push(`Added "${currentItem.name}" to the bill.`);
  }

  function duplicateRow(id) {
    setRows((r) => {
      const src = r.find((row) => row.id === id);
      if (!src) return r;
      const idx = r.findIndex((row) => row.id === id);
      const copy = { ...src, id: uid() };
      const next = [...r];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function updateRow(id, patch) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id) {
    setRows((r) => r.filter((row) => row.id !== id));
    setConfirmRemoveId(null);
  }

  function updateLibraryRate(id, rate) {
    setLibrary((l) => l.map((it) => (it.id === id ? { ...it, rate } : it)));
  }

  function addLibraryItem() {
    const name = newItemName.trim();
    const rate = parseFloat(newItemRate) || 0;
    if (!name) return;
    const item = { id: uid(), cat: activeCat, name, rate };
    setLibrary((l) => [...l, item]);
    setPickedItem(item.id);
    setNewItemName("");
    setNewItemRate("");
    setAddingItem(false);
    push(`Added "${name}" to ${catMeta.label}.`);
  }

  const subtotal = useMemo(() => rows.reduce((s, r) => s + r.qty * r.rate, 0), [rows]);
  const contingency = subtotal * (parseFloat(contingencyPct || 0) / 100);
  const afterContingency = subtotal + contingency;
  const vat = afterContingency * (parseFloat(vatPct || 0) / 100);
  const grandTotal = afterContingency + vat;
  const zeroRateCount = rows.filter((r) => r.rate === 0).length;

  async function saveEstimate() {
    setSavingBusy(true);
    try {
      const slug = slugify(projectName);
      const key = `estimate:${slug}`;
      await window.storage.set(
        key,
        JSON.stringify({ projectName, rows, contingencyPct, vatPct, savedAt: Date.now() }),
        false
      );
      const res = await window.storage.get("estimate_index", false).catch(() => null);
      const idx = res && res.value ? JSON.parse(res.value) : [];
      const filtered = idx.filter((e) => e.slug !== slug);
      filtered.unshift({ slug, name: projectName || "Untitled", updatedAt: Date.now() });
      await window.storage.set("estimate_index", JSON.stringify(filtered), false);
      setSavedList(filtered);
      push("Estimate saved.");
    } catch (e) {
      push("Could not save — check your connection and try again.", "error");
    } finally {
      setSavingBusy(false);
    }
  }

  async function loadEstimate(slug) {
    try {
      const res = await window.storage.get(`estimate:${slug}`, false);
      if (res && res.value) {
        const data = JSON.parse(res.value);
        setProjectName(data.projectName || slug);
        setRows(data.rows || []);
        setContingencyPct(data.contingencyPct ?? 3);
        setVatPct(data.vatPct ?? 13);
        setShowLoadPanel(false);
        push(`Loaded "${data.projectName || slug}".`);
      }
    } catch (e) {
      push("That estimate could not be found.", "error");
    }
  }

  async function deleteSavedEstimate(slug) {
    try {
      await window.storage.delete(`estimate:${slug}`, false).catch(() => null);
      const next = savedList.filter((e) => e.slug !== slug);
      await window.storage.set("estimate_index", JSON.stringify(next), false);
      setSavedList(next);
      setConfirmRemoveSaved(null);
      push("Saved estimate deleted.");
    } catch (e) {
      push("Could not delete that estimate.", "error");
    }
  }

  function printEstimate() {
    window.print();
  }

  function exportCSV() {
    const header = ["#", "Description", "Qty", "Unit", "Rate (Rs.)", "Amount (Rs.)"];
    const body = rows.map((r, i) => [
      i + 1,
      `"${r.name.replace(/"/g, '""')}"`,
      r.qty,
      r.unit,
      r.rate,
      (r.qty * r.rate).toFixed(2),
    ]);
    const totals = [
      [],
      ["", "", "", "", "Subtotal", subtotal.toFixed(2)],
      ["", "", "", "", `Contingency (${contingencyPct}%)`, contingency.toFixed(2)],
      ["", "", "", "", `VAT (${vatPct}%)`, vat.toFixed(2)],
      ["", "", "", "", "Grand Total", grandTotal.toFixed(2)],
    ];
    const csv = [header, ...body, ...totals].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(projectName)}-boq.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    push("BOQ exported as CSV.");
  }

  const filteredItems = library
    .filter((i) => i.cat === activeCat)
    .filter((i) => i.name.toLowerCase().includes(itemQuery.trim().toLowerCase()));

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: COLORS.paper,
        backgroundImage: `linear-gradient(${COLORS.lineSoft} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.lineSoft} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        minHeight: "100vh",
        color: COLORS.ink,
      }}
    >
      <style>{FONT_IMPORT}</style>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; }
          body { background: white !important; }
        }
        @keyframes toastIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .lib-btn:hover { background: ${COLORS.paperDark}; }
        .icon-btn:hover { background: rgba(27,58,92,0.08); }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
        .row-line:hover { background: rgba(27,58,92,0.035); }
        input, select, button, textarea { font-family: inherit; }
        *:focus-visible { outline: 2px solid ${COLORS.brass}; outline-offset: 1px; }
        ::placeholder { color: #9CA6B2; }
      `}</style>

      <ToastStack toasts={toasts} />

      {/* Header */}
      <header
        className="no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: COLORS.blueprint,
          color: "#fff",
        }}
      >
        <div
          style={{
            padding: "16px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                border: `1.4px solid ${COLORS.brass}`,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                color: COLORS.brass,
                flexShrink: 0,
              }}
            >
              EM
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: 0.2,
                }}
              >
                EstiMate
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 1 }}>
                Quantity takeoff &amp; BOQ costing — DUDBC-style rate structure
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              aria-label="Project name"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.28)",
                borderRadius: 4,
                padding: "9px 12px",
                color: "#fff",
                fontSize: 13.5,
                minWidth: 220,
              }}
              placeholder="Project name"
            />
            {activeTab === "boq" && (
              <div
                style={{
                  background: "rgba(184,134,59,0.18)",
                  border: `1px solid ${COLORS.brass}`,
                  borderRadius: 4,
                  padding: "8px 14px",
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.15,
                }}
              >
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: COLORS.brassLight }}>
                  Running total
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 15 }}>
                  Rs. {fmt(grandTotal)}
                </span>
              </div>
            )}
          </div>
        </div>
        <ScaleBar />
      </header>

      {/* Disclaimer strip */}
      <div
        className="no-print"
        style={{
          background: "#F6E9CE",
          borderBottom: `1px solid ${COLORS.line}`,
          padding: "8px 28px",
          fontSize: 12.5,
          color: "#5A4222",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        Rates loaded here are placeholder samples for structure only. Replace them with current
        DUDBC / district rate norms — or your own quoted rates — before relying on this for a real
        estimate. Click any rate to edit it.
      </div>

      {/* Tab nav */}
      <div
        className="no-print"
        style={{ display: "flex", gap: 2, padding: "14px 20px 0", borderBottom: `1px solid ${COLORS.line}`, flexWrap: "wrap" }}
      >
        {[
          { key: "boq", label: "Quantity & BOQ" },
          { key: "rateAnalysis", label: "Rate Analysis (Unit 4)" },
          { key: "roadEarthwork", label: "Road / Canal Earthwork" },
          { key: "valuation", label: "Property Valuation" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "10px 18px",
              border: "none",
              borderBottom: activeTab === t.key ? `3px solid ${COLORS.blueprint}` : "3px solid transparent",
              background: "transparent",
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 13.5,
              color: activeTab === t.key ? COLORS.blueprint : COLORS.steel,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "rateAnalysis" ? (
        <RateAnalysis colors={COLORS} fmt={fmt} th={th} td={td} numEdit={numEdit} />
      ) : activeTab === "roadEarthwork" ? (
        <RoadEarthwork colors={COLORS} fmt={fmt} th={th} td={td} />
      ) : activeTab === "valuation" ? (
        <PropertyValuation colors={COLORS} fmt={fmt} />
      ) : (
        <div style={{ display: "flex", gap: 20, padding: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left: item picker */}
          <div
            className="no-print"
            style={{
              width: 300,
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 6,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                padding: "12px 14px",
                background: COLORS.paperDark,
                color: COLORS.blueprint,
              }}
            >
              Work Sections
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  className="lib-btn"
                  onClick={() => {
                    setActiveCat(c.key);
                    setItemQuery("");
                    setAddingItem(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: `1px solid ${COLORS.line}`,
                    background: activeCat === c.key ? COLORS.paperDark : "transparent",
                    fontWeight: activeCat === c.key ? 600 : 400,
                    fontSize: 13.5,
                    cursor: "pointer",
                    color: COLORS.ink,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                padding: "12px 14px 8px",
                background: COLORS.paperDark,
                color: COLORS.blueprint,
              }}
            >
              Items in {shapeFor(activeCat).label}
            </div>
            <div style={{ padding: "0 10px 10px", background: COLORS.paperDark }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 8, top: 9, color: COLORS.steel }} />
                <input
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Filter items…"
                  style={{
                    width: "100%",
                    padding: "7px 8px 7px 26px",
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 4,
                    fontSize: 12.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {filteredItems.length === 0 && (
                <div style={{ padding: 16, fontSize: 12.5, color: COLORS.steel, textAlign: "center" }}>
                  No items match "{itemQuery}".
                </div>
              )}
              {filteredItems.map((it) => (
                <div
                  key={it.id}
                  onClick={() => setPickedItem(it.id)}
                  style={{
                    padding: "9px 14px",
                    borderBottom: `1px solid ${COLORS.line}`,
                    background: pickedItem === it.id ? "#EAF1F7" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 6 }}>
                    {it.name}
                    {it.rate === 0 && (
                      <span title="Rate not set" style={{ color: COLORS.rust }}>
                        <AlertTriangle size={11} />
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: COLORS.steel }}>Rs.</span>
                    <input
                      type="number"
                      min="0"
                      value={it.rate}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateLibraryRate(it.id, Math.max(0, parseFloat(e.target.value) || 0))}
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 12.5,
                        width: 80,
                        border: `1px solid ${COLORS.line}`,
                        borderRadius: 3,
                        padding: "2px 5px",
                      }}
                    />
                    <span style={{ fontSize: 11, color: COLORS.steel }}>/{shapeFor(it.cat).unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 10, borderTop: `1px solid ${COLORS.line}` }}>
              {!addingItem ? (
                <button
                  onClick={() => setAddingItem(true)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    border: `1px dashed ${COLORS.steel}`,
                    background: "transparent",
                    borderRadius: 4,
                    padding: "8px 10px",
                    fontSize: 12.5,
                    color: COLORS.blueprint,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={13} /> Add item to this section
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    autoFocus
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Item description"
                    style={{ padding: "7px 8px", border: `1px solid ${COLORS.line}`, borderRadius: 4, fontSize: 12.5 }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="number"
                      min="0"
                      value={newItemRate}
                      onChange={(e) => setNewItemRate(e.target.value)}
                      placeholder="Rate Rs."
                      style={{
                        flex: 1,
                        padding: "7px 8px",
                        border: `1px solid ${COLORS.line}`,
                        borderRadius: 4,
                        fontSize: 12.5,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    />
                    <button
                      onClick={addLibraryItem}
                      disabled={!newItemName.trim()}
                      style={{
                        background: newItemName.trim() ? COLORS.blueprint : COLORS.line,
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        padding: "0 12px",
                        fontSize: 12.5,
                        cursor: newItemName.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAddingItem(false);
                        setNewItemName("");
                        setNewItemRate("");
                      }}
                      style={{ background: "transparent", border: "none", color: COLORS.steel, cursor: "pointer" }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle: quantity takeoff + ledger */}
          <div style={{ flex: 1, minWidth: 340 }}>
            {/* Takeoff input card */}
            <div
              className="no-print"
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 6,
                padding: 16,
                marginBottom: 16,
                display: "flex",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <ShapeIcon shape={catMeta.shape} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 12, color: COLORS.steel, marginBottom: 4 }}>
                  {currentItem ? currentItem.name : "Select an item"} — enter{" "}
                  {catMeta.shape === "volume"
                    ? "length × width × height (m)"
                    : catMeta.shape === "area"
                    ? "length × width (m)"
                    : catMeta.shape === "weight"
                    ? "weight (kg)"
                    : "quantity (Nos)"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {catMeta.shape === "volume" && (
                    <>
                      <DimInput label="L" value={dims.l} onChange={(v) => setDims((d) => ({ ...d, l: v }))} colors={COLORS} />
                      <DimInput label="W" value={dims.w} onChange={(v) => setDims((d) => ({ ...d, w: v }))} colors={COLORS} />
                      <DimInput label="H" value={dims.h} onChange={(v) => setDims((d) => ({ ...d, h: v }))} colors={COLORS} />
                    </>
                  )}
                  {catMeta.shape === "area" && (
                    <>
                      <DimInput label="L" value={dims.l} onChange={(v) => setDims((d) => ({ ...d, l: v }))} colors={COLORS} />
                      <DimInput label="W" value={dims.w} onChange={(v) => setDims((d) => ({ ...d, w: v }))} colors={COLORS} />
                    </>
                  )}
                  {(catMeta.shape === "weight" || catMeta.shape === "count") && (
                    <DimInput
                      label={catMeta.shape === "weight" ? "kg" : "Nos"}
                      value={dims.n}
                      onChange={(v) => setDims((d) => ({ ...d, n: v }))}
                      colors={COLORS}
                    />
                  )}
                  <div
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 13,
                      color: previewQty > 0 ? COLORS.blueprint : COLORS.steel,
                      alignSelf: "center",
                      marginLeft: 4,
                    }}
                  >
                    = {fmt(previewQty)} {catMeta.unit}
                  </div>
                </div>
              </div>
              <button
                onClick={addRow}
                disabled={!canAdd}
                style={{
                  background: canAdd ? COLORS.blueprint : COLORS.line,
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "10px 18px",
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: canAdd ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={15} /> Add to estimate
              </button>
            </div>

            {/* Ledger */}
            <div
              ref={printRef}
              className="print-area"
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  padding: "14px 16px",
                  borderBottom: `1px solid ${COLORS.line}`,
                  color: COLORS.blueprint,
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <span>{projectName || "Untitled Building Estimate"}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.steel }}>
                  Bill of Quantities · {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>

              {zeroRateCount > 0 && (
                <div
                  className="no-print"
                  style={{
                    background: "#FBE9E4",
                    color: COLORS.rust,
                    fontSize: 12,
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertTriangle size={13} />
                  {zeroRateCount} line item{zeroRateCount > 1 ? "s" : ""} still {zeroRateCount > 1 ? "have" : "has"} a Rs. 0 rate — the total below is understated until you set {zeroRateCount > 1 ? "them" : "it"}.
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: COLORS.paperDark, textAlign: "left" }}>
                      <th style={th}>#</th>
                      <th style={th}>Description</th>
                      <th style={{ ...th, textAlign: "right" }}>Qty</th>
                      <th style={th}>Unit</th>
                      <th style={{ ...th, textAlign: "right" }}>Rate (Rs.)</th>
                      <th style={{ ...th, textAlign: "right" }}>Amount (Rs.)</th>
                      <th className="no-print" style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 28, textAlign: "center", color: COLORS.steel }}>
                          No items yet. Pick a work section on the left, measure it, and add it to the bill.
                        </td>
                      </tr>
                    )}
                    {rows.map((r, idx) => (
                      <tr key={r.id} className="row-line">
                        <td style={td}>{idx + 1}</td>
                        <td style={td}>{r.name}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                          <input
                            type="number"
                            min="0"
                            value={r.qty}
                            onChange={(e) => updateRow(r.id, { qty: Math.max(0, parseFloat(e.target.value) || 0) })}
                            style={numEdit}
                          />
                        </td>
                        <td style={td}>{r.unit}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                          <input
                            type="number"
                            min="0"
                            value={r.rate}
                            onChange={(e) => updateRow(r.id, { rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                            style={{ ...numEdit, color: r.rate === 0 ? COLORS.rust : COLORS.ink }}
                          />
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontWeight: 600,
                          }}
                        >
                          {fmt(r.qty * r.rate)}
                        </td>
                        <td className="no-print" style={{ ...td, whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                            <button
                              className="icon-btn"
                              onClick={() => duplicateRow(r.id)}
                              title="Duplicate line"
                              style={iconBtnStyle(COLORS.steel)}
                            >
                              <Copy size={13} />
                            </button>
                            {confirmRemoveId === r.id ? (
                              <>
                                <button
                                  onClick={() => removeRow(r.id)}
                                  style={{ ...iconBtnStyle(COLORS.rust), fontSize: 11, width: "auto", padding: "0 8px" }}
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmRemoveId(null)}
                                  style={iconBtnStyle(COLORS.steel)}
                                >
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <button
                                className="icon-btn"
                                onClick={() => setConfirmRemoveId(r.id)}
                                title="Remove line"
                                style={iconBtnStyle(COLORS.rust)}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ padding: 16, borderTop: `1px solid ${COLORS.line}` }}>
                <TotalLine label="Subtotal" value={subtotal} colors={COLORS} />
                <TotalLine
                  label={
                    <span>
                      Contingency{" "}
                      <input
                        className="no-print"
                        type="number"
                        min="0"
                        value={contingencyPct}
                        onChange={(e) => setContingencyPct(e.target.value)}
                        style={{ ...numEdit, width: 44 }}
                      />
                      <span className="no-print">%</span>
                    </span>
                  }
                  value={contingency}
                  colors={COLORS}
                />
                <TotalLine
                  label={
                    <span>
                      VAT{" "}
                      <input
                        className="no-print"
                        type="number"
                        min="0"
                        value={vatPct}
                        onChange={(e) => setVatPct(e.target.value)}
                        style={{ ...numEdit, width: 44 }}
                      />
                      <span className="no-print">%</span>
                    </span>
                  }
                  value={vat}
                  colors={COLORS}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `2px solid ${COLORS.blueprint}`,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 18,
                    color: COLORS.blueprint,
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap", position: "relative" }}>
              <button onClick={saveEstimate} disabled={savingBusy} style={btnSecondary(COLORS)}>
                <Save size={14} /> {savingBusy ? "Saving…" : "Save estimate"}
              </button>
              <button onClick={printEstimate} style={btnSecondary(COLORS)}>
                <Printer size={14} /> Print / Export PDF
              </button>
              <button onClick={exportCSV} disabled={rows.length === 0} style={btnSecondary(COLORS, rows.length === 0)}>
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={() => setShowLoadPanel((s) => !s)}
                style={btnSecondary(COLORS, false, showLoadPanel)}
              >
                <FolderOpen size={14} /> Load saved ({savedList.length})
              </button>

              {showLoadPanel && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    width: 320,
                    maxHeight: 280,
                    overflowY: "auto",
                    background: COLORS.card,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 6,
                    boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
                    zIndex: 30,
                  }}
                >
                  {savedList.length === 0 ? (
                    <div style={{ padding: 16, fontSize: 12.5, color: COLORS.steel, textAlign: "center" }}>
                      Nothing saved yet. Save this estimate to see it here.
                    </div>
                  ) : (
                    savedList.map((e) => (
                      <div
                        key={e.slug}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderBottom: `1px solid ${COLORS.line}`,
                          gap: 8,
                        }}
                      >
                        <button
                          onClick={() => loadEstimate(e.slug)}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.blueprint, display: "flex", alignItems: "center", gap: 4 }}>
                            {e.name} <ChevronRight size={12} />
                          </span>
                          <span style={{ fontSize: 11, color: COLORS.steel }}>
                            {e.updatedAt ? new Date(e.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </button>
                        {confirmRemoveSaved === e.slug ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => deleteSavedEstimate(e.slug)} style={{ ...iconBtnStyle(COLORS.rust), fontSize: 11, width: "auto", padding: "0 6px" }}>
                              Confirm
                            </button>
                            <button onClick={() => setConfirmRemoveSaved(null)} style={iconBtnStyle(COLORS.steel)}>
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmRemoveSaved(e.slug)} style={iconBtnStyle(COLORS.rust)} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate Analysis (Unit 4)
// ---------------------------------------------------------------------------
function RateAnalysis({ colors: COLORS, fmt, th, td }) {
  const [workType, setWorkType] = useState("concrete");
  const [ratio, setRatio] = useState({ cement: 1, sand: 2, aggregate: 4 });
  const [volume, setVolume] = useState(1);
  const [dryFactorPct, setDryFactorPct] = useState(54);
  const [cementDensity, setCementDensity] = useState(1440);
  const [bagWeight, setBagWeight] = useState(50);
  const [wcRatio, setWcRatio] = useState(0.5);

  const [rateCementBag, setRateCementBag] = useState(1650);
  const [rateSand, setRateSand] = useState(2800);
  const [rateAggregate, setRateAggregate] = useState(3200);
  const [skilledLabour, setSkilledLabour] = useState(0);
  const [unskilledLabour, setUnskilledLabour] = useState(0);
  const [overheadPct, setOverheadPct] = useState(15);
  const [applyVat, setApplyVat] = useState(true);
  const [vatPct, setVatPct] = useState(13);

  function switchType(t) {
    setWorkType(t);
    setDryFactorPct(t === "concrete" ? 54 : 30);
    if (t === "mortar") setRatio((r) => ({ cement: r.cement || 1, sand: r.sand || 6, aggregate: 0 }));
    else setRatio((r) => ({ cement: r.cement || 1, sand: r.sand || 2, aggregate: r.aggregate || 4 }));
  }

  const parts = workType === "concrete" ? [ratio.cement, ratio.sand, ratio.aggregate] : [ratio.cement, ratio.sand];
  const totalParts = parts.reduce((s, p) => s + (parseFloat(p) || 0), 0);
  const wetVol = parseFloat(volume) || 0;
  const dryVol = wetVol * (1 + (parseFloat(dryFactorPct) || 0) / 100);
  const volPerPart = totalParts > 0 ? dryVol / totalParts : 0;

  const cementVol = volPerPart * (parseFloat(ratio.cement) || 0);
  const sandVol = volPerPart * (parseFloat(ratio.sand) || 0);
  const aggVol = workType === "concrete" ? volPerPart * (parseFloat(ratio.aggregate) || 0) : 0;

  const cementWeight = cementVol * (parseFloat(cementDensity) || 0);
  const cementBags = bagWeight > 0 ? cementWeight / bagWeight : 0;
  const waterLitres = cementWeight * (parseFloat(wcRatio) || 0);

  const materialCost = cementBags * rateCementBag + sandVol * rateSand + aggVol * rateAggregate;
  const unskilled = parseFloat(unskilledLabour) || 0;
  const skilled = parseFloat(skilledLabour) || 0;
  const toolsHire = unskilled * 0.03;
  const subtotalA = materialCost + skilled + unskilled + toolsHire;
  const overhead = subtotalA * ((parseFloat(overheadPct) || 0) / 100);
  const subtotalB = subtotalA + overhead;
  const vatAmt = applyVat ? subtotalB * ((parseFloat(vatPct) || 0) / 100) : 0;
  const grandTotal = subtotalB + vatAmt;
  const ratePerUnit = wetVol > 0 ? grandTotal / wetVol : 0;

  const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0" };
  const labelStyle = { fontSize: 13, color: COLORS.ink };
  const smallInput = { width: 90, padding: "6px 8px", border: `1px solid ${COLORS.line}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, textAlign: "right" };

  return (
    <div style={{ padding: 20, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ width: 360, flexShrink: 0, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.blueprint, marginBottom: 10 }}>
          Rate Analysis Inputs
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["concrete", "mortar"].map((t) => (
            <button
              key={t}
              onClick={() => switchType(t)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 4,
                border: `1px solid ${COLORS.line}`,
                background: workType === t ? COLORS.blueprint : "#fff",
                color: workType === t ? "#fff" : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t === "concrete" ? "Concrete (3-part, e.g. PCC/RCC)" : "Mortar (2-part, e.g. masonry/plaster)"}
            </button>
          ))}
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Mix ratio — Cement</span>
          <input type="number" value={ratio.cement} onChange={(e) => setRatio((r) => ({ ...r, cement: e.target.value }))} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Sand</span>
          <input type="number" value={ratio.sand} onChange={(e) => setRatio((r) => ({ ...r, sand: e.target.value }))} style={smallInput} />
        </div>
        {workType === "concrete" && (
          <div style={rowStyle}>
            <span style={labelStyle}>Aggregate</span>
            <input type="number" value={ratio.aggregate} onChange={(e) => setRatio((r) => ({ ...r, aggregate: e.target.value }))} style={smallInput} />
          </div>
        )}
        <div style={rowStyle}>
          <span style={labelStyle}>Volume required (m³)</span>
          <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Dry-volume factor (%)</span>
          <input type="number" value={dryFactorPct} onChange={(e) => setDryFactorPct(e.target.value)} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Cement density (kg/m³)</span>
          <input type="number" value={cementDensity} onChange={(e) => setCementDensity(e.target.value)} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Bag weight (kg)</span>
          <input type="number" value={bagWeight} onChange={(e) => setBagWeight(e.target.value)} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Water–cement ratio</span>
          <input type="number" step="0.01" value={wcRatio} onChange={(e) => setWcRatio(e.target.value)} style={smallInput} />
        </div>

        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: COLORS.blueprint, margin: "16px 0 6px" }}>
          Market Rates &amp; Labour
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Rate — cement (Rs./bag)</span>
          <input type="number" value={rateCementBag} onChange={(e) => setRateCementBag(parseFloat(e.target.value) || 0)} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Rate — sand (Rs./m³)</span>
          <input type="number" value={rateSand} onChange={(e) => setRateSand(parseFloat(e.target.value) || 0)} style={smallInput} />
        </div>
        {workType === "concrete" && (
          <div style={rowStyle}>
            <span style={labelStyle}>Rate — aggregate (Rs./m³)</span>
            <input type="number" value={rateAggregate} onChange={(e) => setRateAggregate(parseFloat(e.target.value) || 0)} style={smallInput} />
          </div>
        )}
        <div style={rowStyle}>
          <span style={labelStyle}>Skilled labour cost (Rs.)</span>
          <input type="number" value={skilledLabour} onChange={(e) => setSkilledLabour(e.target.value)} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Unskilled labour cost (Rs.)</span>
          <input type="number" value={unskilledLabour} onChange={(e) => setUnskilledLabour(e.target.value)} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Overhead &amp; profit (%)</span>
          <input type="number" value={overheadPct} onChange={(e) => setOverheadPct(e.target.value)} style={smallInput} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>
            <input type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} style={{ marginRight: 6 }} />
            Apply VAT (%)
          </span>
          <input type="number" value={vatPct} disabled={!applyVat} onChange={(e) => setVatPct(e.target.value)} style={{ ...smallInput, opacity: applyVat ? 1 : 0.4 }} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 340 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, padding: "12px 16px", borderBottom: `1px solid ${COLORS.line}`, color: COLORS.blueprint }}>
            Material Quantities — mix {parts.join(":")}, for {fmt(wetVol)} m³
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: COLORS.paperDark, textAlign: "left" }}>
                <th style={th}>Material</th>
                <th style={{ ...th, textAlign: "right" }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={td}>Cement</td><td style={{ ...td, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(cementBags)} bags ({fmt(cementWeight)} kg)</td></tr>
              <tr><td style={td}>Sand</td><td style={{ ...td, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(sandVol)} m³</td></tr>
              {workType === "concrete" && (
                <tr><td style={td}>Aggregate</td><td style={{ ...td, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(aggVol)} m³</td></tr>
              )}
              <tr><td style={td}>Water</td><td style={{ ...td, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(waterLitres)} litres</td></tr>
              <tr><td style={td}>Dry volume (for reference)</td><td style={{ ...td, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(dryVol)} m³</td></tr>
            </tbody>
          </table>
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.blueprint, marginBottom: 10 }}>
            Rate Build-up (Government Procedure)
          </div>
          <RaLine label="(x) Material cost" value={materialCost} fmt={fmt} />
          <RaLine label="(y) Labour cost (skilled + unskilled)" value={skilled + unskilled} fmt={fmt} />
          <RaLine label="(z) Hire of tools & plants (3% of unskilled labour)" value={toolsHire} fmt={fmt} />
          <RaLine label="Subtotal A = x + y + z" value={subtotalA} bold fmt={fmt} />
          <RaLine label={`Overhead & profit (${overheadPct}% of A)`} value={overhead} fmt={fmt} />
          <RaLine label="Subtotal B" value={subtotalB} bold fmt={fmt} />
          {applyVat && <RaLine label={`VAT (${vatPct}% of B)`} value={vatAmt} fmt={fmt} />}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `2px solid ${COLORS.blueprint}`, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: COLORS.blueprint }}>
            <span>Grand Total</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(grandTotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12.5, color: COLORS.steel }}>
            <span>Rate per m³</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(ratePerUnit)} / m³</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RaLine({ label, value, fmt, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "4px 0", fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(value)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Road / Canal Earthwork
// ---------------------------------------------------------------------------
function RoadEarthwork({ colors: COLORS, fmt, th, td }) {
  const [method, setMethod] = useState("trapezoidal");
  const [stations, setStations] = useState([
    { id: uid(), label: "Ch. 0", b: 6, h: 1.2, n: 1.5, area: null, length: 20 },
    { id: uid(), label: "Ch. 1", b: 6, h: 1.6, n: 1.5, area: null, length: 20 },
    { id: uid(), label: "Ch. 2", b: 6, h: 1.0, n: 1.5, area: null, length: 20 },
  ]);

  function areaOf(s) {
    if (s.area !== null && s.area !== "" && s.area !== undefined) return parseFloat(s.area) || 0;
    const b = parseFloat(s.b) || 0, h = parseFloat(s.h) || 0, n = parseFloat(s.n) || 0;
    return b * h + n * h * h;
  }

  function updateStation(id, patch) {
    setStations((st) => st.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addStation() {
    setStations((st) => [...st, { id: uid(), label: `Ch. ${st.length}`, b: 6, h: 1.0, n: 1.5, area: null, length: 20 }]);
  }
  function removeStation(id) {
    setStations((st) => (st.length > 2 ? st.filter((s) => s.id !== id) : st));
  }

  const areas = stations.map(areaOf);
  const segmentLengths = stations.slice(0, -1).map((s) => parseFloat(s.length) || 0);
  const unequalSpacing = segmentLengths.length > 1 && segmentLengths.some((l) => Math.abs(l - segmentLengths[0]) > 1e-6);

  let volume = 0;
  let note = "";
  let warning = "";
  if (method === "trapezoidal") {
    for (let i = 0; i < stations.length - 1; i++) {
      const L = parseFloat(stations[i].length) || 0;
      volume += (L * (areas[i] + areas[i + 1])) / 2;
    }
    note = "V = Σ L·(A₁+A₂)/2 between each consecutive pair of stations.";
  } else if (method === "midsectional") {
    for (let i = 0; i < stations.length - 1; i++) {
      const L = parseFloat(stations[i].length) || 0;
      volume += areas[i] * L;
    }
    note = "V = Σ (mid-section area of segment) × (segment length). Enter each station's area as the measured mid-section area for the segment that follows it.";
  } else if (method === "prismoidal") {
    if (stations.length % 2 === 0) {
      note = "Prismoidal formula needs an odd number of stations (even number of equal-length intervals). Add or remove a station.";
    } else {
      const L = parseFloat(stations[0].length) || 0;
      let sumOdd = 0, sumEven = 0;
      for (let i = 1; i < stations.length - 1; i++) {
        if (i % 2 === 1) sumOdd += areas[i];
        else sumEven += areas[i];
      }
      volume = (L / 3) * (areas[0] + areas[areas.length - 1] + 4 * sumOdd + 2 * sumEven);
      note = "V = L/3 · [A₁ + Aₙ + 4·(Σ odd-position areas) + 2·(Σ even-interior areas)] — Simpson's rule form of the prismoidal formula. Assumes equal spacing L between all stations.";
      if (unequalSpacing) {
        warning = "Your station spacings aren't equal, but the prismoidal formula requires them to be — it's using the first segment's length (" + fmt(L) + " m) throughout, so this result won't reflect your actual chainages. Use trapezoidal or mid-sectional instead, or set every segment to the same length.";
      }
    }
  }

  const smallInput = { width: 70, padding: "5px 6px", border: `1px solid ${COLORS.line}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, textAlign: "right" };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "trapezoidal", label: "Mean-Sectional (Trapezoidal)" },
          { key: "prismoidal", label: "Prismoidal Formula" },
          { key: "midsectional", label: "Mid-Sectional Method" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            style={{
              padding: "9px 14px",
              borderRadius: 4,
              border: `1px solid ${COLORS.line}`,
              background: method === m.key ? COLORS.blueprint : "#fff",
              color: method === m.key ? "#fff" : COLORS.ink,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#F6E9CE", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "10px 14px", fontSize: 12.5, color: "#5A4222", marginBottom: 16 }}>
        Each station's area auto-computes from formation width (b), depth/height (h) and side slope (n) using
        Area = b·h + n·h² — the simple level-ground case. For sloping or hilly ground, type the area you've
        already derived for that station directly into the Area field to override.
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ background: COLORS.paperDark, textAlign: "left" }}>
                <th style={th}>Station</th>
                <th style={{ ...th, textAlign: "right" }}>Width b (m)</th>
                <th style={{ ...th, textAlign: "right" }}>Depth/Ht h (m)</th>
                <th style={{ ...th, textAlign: "right" }}>Side slope n</th>
                <th style={{ ...th, textAlign: "right" }}>Area (m², override)</th>
                <th style={{ ...th, textAlign: "right" }}>Computed Area</th>
                <th style={{ ...th, textAlign: "right" }}>Segment length to next (m)</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s, i) => (
                <tr key={s.id}>
                  <td style={td}>
                    <input value={s.label} onChange={(e) => updateStation(s.id, { label: e.target.value })} style={{ ...smallInput, width: 90, textAlign: "left" }} />
                  </td>
                  <td style={td}><input type="number" value={s.b} onChange={(e) => updateStation(s.id, { b: e.target.value })} style={smallInput} /></td>
                  <td style={td}><input type="number" value={s.h} onChange={(e) => updateStation(s.id, { h: e.target.value })} style={smallInput} /></td>
                  <td style={td}><input type="number" value={s.n} onChange={(e) => updateStation(s.id, { n: e.target.value })} style={smallInput} /></td>
                  <td style={td}>
                    <input
                      type="number"
                      placeholder="auto"
                      value={s.area === null ? "" : s.area}
                      onChange={(e) => updateStation(s.id, { area: e.target.value === "" ? null : e.target.value })}
                      style={smallInput}
                    />
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(areas[i])} m²</td>
                  <td style={td}>
                    {i < stations.length - 1 ? (
                      <input type="number" value={s.length} onChange={(e) => updateStation(s.id, { length: e.target.value })} style={smallInput} />
                    ) : (
                      <span style={{ color: COLORS.steel, fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={td}>
                    <button onClick={() => removeStation(s.id)} style={{ border: "none", background: "none", color: COLORS.rust, cursor: "pointer", fontSize: 12 }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 10 }}>
          <button onClick={addStation} style={{ border: `1px solid ${COLORS.line}`, background: "#fff", borderRadius: 4, padding: "7px 14px", fontSize: 12.5, cursor: "pointer", color: COLORS.blueprint }}>
            + Add station
          </button>
        </div>
      </div>

      {warning && (
        <div style={{ background: "#FBE9E4", border: `1px solid ${COLORS.rust}`, borderRadius: 6, padding: "10px 14px", fontSize: 12.5, color: COLORS.rust, marginBottom: 16, maxWidth: 640, display: "flex", gap: 8 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{warning}</span>
        </div>
      )}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16, maxWidth: 560 }}>
        <div style={{ fontSize: 12.5, color: COLORS.steel, marginBottom: 8 }}>{note}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.blueprint }}>
          <span>Total Earthwork Volume</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(volume)} m³</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property Valuation
// ---------------------------------------------------------------------------
function PropertyValuation({ colors: COLORS, fmt }) {
  const [mode, setMode] = useState("straight");

  const [cost, setCost] = useState(2500000);
  const [scrap, setScrap] = useState(100000);
  const [life, setLife] = useState(50);
  const [age, setAge] = useState(15);
  const [sinkingRate, setSinkingRate] = useState(4);

  const [netIncome, setNetIncome] = useState(180000);
  const [interestRate, setInterestRate] = useState(8);

  const smallInput = { width: 130, padding: "6px 8px", border: `1px solid ${COLORS.line}`, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, textAlign: "right" };
  const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0" };

  const annualDep = life > 0 ? (cost - scrap) / life : 0;
  const straightDepValue = cost - annualDep * age;

  const r = life > 0 && cost > 0 ? 1 - Math.pow(scrap / cost, 1 / life) : 0;
  const decliningValue = cost * Math.pow(1 - r, age);

  const i = (parseFloat(sinkingRate) || 0) / 100;
  const totalDep = cost - scrap;
  const sinkingFactorLife = i > 0 ? i / (Math.pow(1 + i, life) - 1) : life > 0 ? 1 / life : 0;
  const annualInstallment = totalDep * sinkingFactorLife;
  const accumulatedAtAge = i > 0 ? annualInstallment * ((Math.pow(1 + i, age) - 1) / i) : annualInstallment * age;
  const sinkingFundValue = cost - accumulatedAtAge;

  const yearsPurchase = interestRate > 0 ? 100 / interestRate : 0;
  const capitalizedValue = netIncome * yearsPurchase;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "straight", label: "Straight Line Depreciation" },
          { key: "declining", label: "Constant % (Declining Balance)" },
          { key: "sinkingfund", label: "Sinking Fund Method" },
          { key: "capitalized", label: "Capitalized Value / Year's Purchase" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              padding: "9px 14px",
              borderRadius: 4,
              border: `1px solid ${COLORS.line}`,
              background: mode === m.key ? COLORS.blueprint : "#fff",
              color: mode === m.key ? "#fff" : COLORS.ink,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode !== "capitalized" ? (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ width: 320, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16 }}>
            <div style={rowStyle}><span>Original / replacement cost (Rs.)</span><input type="number" value={cost} onChange={(e) => setCost(parseFloat(e.target.value) || 0)} style={smallInput} /></div>
            <div style={rowStyle}><span>Scrap / salvage value (Rs.)</span><input type="number" value={scrap} onChange={(e) => setScrap(parseFloat(e.target.value) || 0)} style={smallInput} /></div>
            <div style={rowStyle}><span>Total useful life (years)</span><input type="number" value={life} onChange={(e) => setLife(parseFloat(e.target.value) || 0)} style={smallInput} /></div>
            <div style={rowStyle}><span>Present age (years)</span><input type="number" value={age} onChange={(e) => setAge(parseFloat(e.target.value) || 0)} style={smallInput} /></div>
            {mode === "sinkingfund" && (
              <div style={rowStyle}><span>Sinking fund interest rate (%)</span><input type="number" value={sinkingRate} onChange={(e) => setSinkingRate(e.target.value)} style={smallInput} /></div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 300, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16 }}>
            {mode === "straight" && (
              <>
                <RaLine label="Annual depreciation = (Cost − Scrap) / Life" value={annualDep} fmt={fmt} />
                <RaLine label={`Depreciation to date (× ${age} yrs)`} value={annualDep * age} fmt={fmt} />
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `2px solid ${COLORS.blueprint}`, display: "flex", justifyContent: "space-between", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: COLORS.blueprint }}>
                  <span>Present Depreciated Value</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(straightDepValue)}</span>
                </div>
              </>
            )}
            {mode === "declining" && (
              <>
                <RaLine label="Annual depreciation rate r = 1 − (Scrap/Cost)^(1/Life)" value={r * 100} fmt={(v) => fmt(v) + " %"} />
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `2px solid ${COLORS.blueprint}`, display: "flex", justifyContent: "space-between", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: COLORS.blueprint }}>
                  <span>Present Depreciated Value</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(decliningValue)}</span>
                </div>
              </>
            )}
            {mode === "sinkingfund" && (
              <>
                <RaLine label="Total depreciation (Cost − Scrap)" value={totalDep} fmt={fmt} />
                <RaLine label="Annual sinking fund installment" value={annualInstallment} fmt={fmt} />
                <RaLine label={`Accumulated sinking fund at ${age} yrs`} value={accumulatedAtAge} fmt={fmt} />
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `2px solid ${COLORS.blueprint}`, display: "flex", justifyContent: "space-between", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: COLORS.blueprint }}>
                  <span>Present Depreciated Value</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(sinkingFundValue)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ width: 320, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16 }}>
            <div style={rowStyle}><span>Net annual income (Rs.)</span><input type="number" value={netIncome} onChange={(e) => setNetIncome(parseFloat(e.target.value) || 0)} style={smallInput} /></div>
            <div style={rowStyle}><span>Rate of interest (%)</span><input type="number" value={interestRate} onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)} style={smallInput} /></div>
          </div>
          <div style={{ flex: 1, minWidth: 300, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16 }}>
            <RaLine label="Year's Purchase = 100 / Rate of interest" value={yearsPurchase} fmt={fmt} />
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `2px solid ${COLORS.blueprint}`, display: "flex", justifyContent: "space-between", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: COLORS.blueprint }}>
              <span>Capitalized Value</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(capitalizedValue)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DimInput({ label, value, onChange, colors }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 11, color: colors.steel, width: 14 }}>{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 62,
          padding: "6px 7px",
          border: `1px solid ${colors.line}`,
          borderRadius: 4,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
        }}
      />
    </div>
  );
}

function TotalLine({ label, value, colors }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13.5,
        padding: "4px 0",
        color: colors.ink,
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Rs. {fmt(value)}</span>
    </div>
  );
}

function iconBtnStyle(color) {
  return {
    border: "none",
    background: "transparent",
    color,
    cursor: "pointer",
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  };
}

function btnSecondary(COLORS, disabled, active) {
  return {
    background: active ? COLORS.paperDark : "#fff",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 4,
    padding: "9px 16px",
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? COLORS.steel : COLORS.blueprint,
    fontWeight: 500,
    opacity: disabled ? 0.55 : 1,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };
}

const th = {
  padding: "8px 10px",
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#4A6C8C",
  borderBottom: `1px solid ${COLORS.line}`,
  whiteSpace: "nowrap",
};
const td = { padding: "8px 10px", borderBottom: `1px solid ${COLORS.line}` };
const numEdit = {
  width: 70,
  border: "1px solid transparent",
  background: "transparent",
  textAlign: "right",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 13,
  borderRadius: 3,
};
