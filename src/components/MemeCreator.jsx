import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import useLocalStorage from "../hooks/useLocalStorage";
import guestDefault from "/assets/guest-default.png";
import backgroundDefault from "/assets/background-default.png";

function useDraggable(initial = { x: 0, y: 0, scale: 1, rot: 0 }) {
  const [t, setT] = useState(initial);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const startT = useRef({ x: 0, y: 0 });

  function onPointerDown(e) {
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    startT.current = { x: t.x, y: t.y };
    (e.target.setPointerCapture?.(e.pointerId));
  }
  function onPointerMove(e) {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    setT((prev) => ({ ...prev, x: startT.current.x + dx, y: startT.current.y + dy }));
  }
  function onPointerUp() {
    dragging.current = false;
  }

  function nudge(dx, dy) {
    setT((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }

  return { t, setT, onPointerDown, onPointerMove, onPointerUp, nudge };
}

export default function MemeCreator() {
  const [poses] = useLocalStorage("chepePoses", []);
  const [bgType, setBgType] = useState("image"); // default to image
  const [bgColor, setBgColor] = useState("#0f172a");
  const [bgImage, setBgImage] = useState(backgroundDefault); // default to background image

  const [userPng, setUserPng] = useState(null);
  const [chepeId, setChepeId] = useState(poses[0]?.id || null);

  // Canvas/export size (fixed 1:1 ratio, UI only controls export size)
  const exportSizes = [
    { label: "Small (400x400)", value: 400 },
    { label: "Medium (600x600)", value: 600 },
    { label: "Large (1000x1000)", value: 1000 },
  ];
  const [exportPx, setExportPx] = useState(600); // default medium

  // Draggable transforms (user PNG & chepe)
  const user = useDraggable({ x: 0, y: 0, scale: 1, rot: 0 });
  const chepe = useDraggable({ x: 150, y: 150, scale: 1, rot: 0 });

  // Container ref to compute center for initial placement
  const stageRef = useRef(null);

  // Fit-to-pane scaling for the stage (right side)
  const viewportRef = useRef(null);
  const [viewScale, setViewScale] = useState(1);

  // Always use 1:1 preview, 600x600px (matches default export size)
  const previewSize = 600;

  useEffect(() => {
    // Center both on mount (use center-coords semantics)
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width * 0.5;
    const cy = rect.height * 0.5;
    // Guest (user) slightly left of center, Chepe slightly right of center
    user.setT((prev) => ({ ...prev, x: cx - 80, y: cy }));
    chepe.setT((prev) => ({ ...prev, x: cx + 80, y: cy }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    function fit() {
      const el = viewportRef.current;
      if (!el) return;
      const availW = el.clientWidth - 16; // account for padding
      const availH = el.clientHeight - 16;
      const s = Math.max(0.1, Math.min(availW / previewSize, availH / previewSize));
      setViewScale(s);
    }
    fit();
    const ro = new ResizeObserver(fit);
    if (viewportRef.current) ro.observe(viewportRef.current);
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, []);

  function onUploadBg(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setBgImage(reader.result);
    reader.readAsDataURL(f);
    e.target.value = "";
    setBgType("image");
  }

  function onUploadUserPng(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setUserPng(reader.result);
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  const chepePose = useMemo(
    () => poses.find((p) => p.id === chepeId) || poses[0],
    [poses, chepeId]
  );

  function wheelScale(setter) {
    return (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setter((prev) => {
        const next = Math.max(0.1, Math.min(5, prev.scale + delta));
        return { ...prev, scale: next };
      });
    };
  }

  function exportPNG() {
    const outW = exportPx;
    const outH = exportPx;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");

    // Helper to draw an image with transform
    function drawImg(dataUrl, transform) {
      return new Promise((resolve) => {
        if (!dataUrl) return resolve();
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.translate(transform.xExport, transform.yExport);
          ctx.rotate((transform.rot * Math.PI) / 180);
          ctx.scale(transform.scaleExport, transform.scaleExport);
          // draw centered
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.restore();
          resolve();
        };
        img.src = dataUrl;
      });
    }

    // Compute export transforms (map from preview to export canvas)
    const stage = stageRef.current.getBoundingClientRect();
    const sx = outW / stage.width;
    const sy = outH / stage.height;

    const makeExportT = (t) => ({
      xExport: t.x * sx,
      yExport: t.y * sy,
      scaleExport: t.scale * ((sx + sy) / 2),
      rot: t.rot,
    });

    // 1) Background
    if (bgType === "color") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, outW, outH);
      chain();
    } else if (bgImage) {
      const img = new Image();
      img.onload = async () => {
        // Cover behavior
        const ratio = Math.max(outW / img.width, outH / img.height);
        const newW = img.width * ratio;
        const newH = img.height * ratio;
        const x = (outW - newW) / 2;
        const y = (outH - newH) / 2;
        ctx.drawImage(img, x, y, newW, newH);
        chain();
      };
      img.src = bgImage;
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, outW, outH);
      chain();
    }

    async function chain() {
      // 2) User PNG
      await drawImg(userPng, makeExportT(user.t));
      // 3) Chepe Pose
      await drawImg(
        chepePose?.filename
          ? `/assets/chepe/${chepePose.filename}`
          : chepePose?.dataUrl,
        makeExportT(chepe.t)
      );
      // Download
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "chepe-meme.png";
      a.click();
    }
  }

  const [selected, setSelected] = useState(null); // 'user' | 'chepe' | null

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="h-full w-full flex">
        {/* Left side panel (controls) */}
        <div className="w-96 max-w-[40vw] shrink-0 h-full overflow-y-auto p-4 bg-slate-800/60 backdrop-blur border-r border-slate-700/60">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Background</h2>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bgType"
                    value="color"
                    checked={bgType === "color"}
                    onChange={() => setBgType("color")}
                  />
                  Color
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bgType"
                    value="image"
                    checked={bgType === "image"}
                    onChange={() => setBgType("image")}
                  />
                  Image
                </label>
              </div>

              {bgType === "color" ? (
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-full rounded border-0 outline-none"
                />
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onUploadBg}
                    className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  />
                  {bgImage && <p className="text-xs text-slate-400 mt-2">Background selected.</p>}
                </div>
              )}
            </div>
            {/* User PNG section simplified */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 flex flex-col items-center">
              <h3 className="text-sm font-medium mb-2">Your Character</h3>
              <button
                className="relative group focus:outline-none"
                onClick={() => document.getElementById("user-png-upload").click()}
                type="button"
              >
                <img
                  src={userPng || guestDefault}
                  alt="Your character"
                  className="w-[100px] h-[100px] object-contain rounded-lg border-2 border-slate-700 shadow bg-slate-800"
                  draggable={false}
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-xs text-white font-semibold">
                  Click to upload
                </span>
              </button>
              <input
                id="user-png-upload"
                type="file"
                accept="image/png"
                onChange={onUploadUserPng}
                className="hidden"
              />
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
              <h3 className="text-sm font-medium mb-2">Chepe</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {poses.length === 0 && (
                  <div className="text-xs text-slate-400">No poses — add in Admin</div>
                )}
                {poses.map((p) => (
                  <button
                    key={p.id}
                    className={`rounded-lg border-2 p-0.5 transition-all ${
                      chepeId === p.id
                        ? "border-blue-500 ring-2 ring-blue-400"
                        : "border-transparent hover:border-slate-500"
                    }`}
                    style={{ background: "#222" }}
                    onClick={() => setChepeId(p.id)}
                    type="button"
                    tabIndex={0}
                  >
                    <div className="w-[60px] h-[60px] flex items-center justify-center">
                      <img
                        src={`/assets/chepe/${p.filename}`}
                        alt={p.name}
                        className="max-w-full max-h-full object-contain rounded"
                        draggable={false}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Export size dropdown */}
              <select
                className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                value={exportPx}
                onChange={e => setExportPx(Number(e.target.value))}
              >
                {exportSizes.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={exportPNG}
                className="w-full px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold"
              >
                Export PNG
              </button>
            </div>
            {/* Removed canvas size controls */}
          </div>
        </div>
        {/* Right side: result frame that fits in the available space */}
        <section ref={viewportRef} className="flex-1 h-full overflow-hidden p-2 md:p-4 bg-slate-900/40">
          <div className="w-full h-full flex items-start justify-start">
            <div
              ref={stageRef}
              className="relative shadow-2xl rounded-lg ring-1 ring-slate-700/60 overflow-hidden"
              style={{
                width: `${previewSize}px`,
                height: `${previewSize}px`,
                transform: `scale(${viewScale})`,
                transformOrigin: "top left",
                background:
                  bgType === "color"
                    ? bgColor
                    : bgImage
                    ? `center/cover no-repeat url(${bgImage})`
                    : "#0f172a",
              }}
              onPointerDown={() => setSelected(null)}
            >
              {/* User PNG (middle layer) */}
              <TransformableLayer
                src={userPng || guestDefault}
                label="User"
                t={user.t}
                setT={user.setT}
                onWheel={wheelScale(user.setT)}
                selected={selected === "user"}
                onSelect={() => setSelected("user")}
              />

              {/* Chepe (top layer) */}
              {chepePose && (
                <TransformableLayer
                  src={
                    chepePose.filename
                      ? `/assets/chepe/${chepePose.filename}`
                      : chepePose.dataUrl // fallback for old data
                  }
                  label="Chepe"
                  t={chepe.t}
                  setT={chepe.setT}
                  onWheel={wheelScale(chepe.setT)}
                  selected={selected === "chepe"}
                  onSelect={() => setSelected("chepe")}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// Replace LayeredImage with on-canvas transform handles
function TransformableLayer({ src, t, setT, onWheel, label, selected, onSelect }) {
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const modeRef = useRef(null); // 'move' | 'scale' | 'rotate'
  const startRef = useRef({ x: 0, y: 0, t: null, dist: 0, angle: 0 });

  // Measure natural image size
  function onImgLoad(e) {
    const img = e.target;
    setDims({ w: img.naturalWidth, h: img.naturalHeight });
  }

  function getCenterScreen() {
    const el = wrapRef.current;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function onPointerDownMove(e) {
    e.stopPropagation();
    onSelect?.();
    modeRef.current = "move";
    startRef.current = { x: e.clientX, y: e.clientY, t: { ...t } };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerDownScale(e) {
    e.stopPropagation();
    onSelect?.();
    const c = getCenterScreen();
    const dx = e.clientX - c.x;
    const dy = e.clientY - c.y;
    const dist = Math.hypot(dx, dy);
    modeRef.current = "scale";
    startRef.current = { x: e.clientX, y: e.clientY, t: { ...t }, dist };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerDownRotate(e) {
    e.stopPropagation();
    onSelect?.();
    const c = getCenterScreen();
    const angle = Math.atan2(e.clientY - c.y, e.clientX - c.x);
    modeRef.current = "rotate";
    startRef.current = { x: e.clientX, y: e.clientY, t: { ...t }, angle };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!modeRef.current) return;
    if (modeRef.current === "move") {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      setT((prev) => ({ ...prev, x: startRef.current.t.x + dx, y: startRef.current.t.y + dy }));
    } else if (modeRef.current === "scale") {
      const c = getCenterScreen();
      const curDist = Math.hypot(e.clientX - c.x, e.clientY - c.y);
      const factor = curDist / Math.max(1e-6, startRef.current.dist);
      const next = Math.max(0.1, Math.min(5, startRef.current.t.scale * factor));
      setT((prev) => ({ ...prev, scale: next }));
    } else if (modeRef.current === "rotate") {
      const c = getCenterScreen();
      const curAngle = Math.atan2(e.clientY - c.y, e.clientX - c.x);
      const deltaDeg = ((curAngle - startRef.current.angle) * 180) / Math.PI;
      const next = Math.round(startRef.current.t.rot + deltaDeg);
      setT((prev) => ({ ...prev, rot: next }));
    }
  }

  function onPointerUp(e) {
    modeRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  const w = Math.max(1, dims.w);
  const h = Math.max(1, dims.h);

  return (
    <div
      ref={wrapRef}
      className="absolute group select-none hover:cursor-grab active:cursor-grabbing"
      style={{
        left: 0,
        top: 0,
        width: `${w}px`,
        height: `${h}px`,
        transform: `translate(${t.x}px, ${t.y}px) translate(${-w / 2}px, ${-h / 2}px) rotate(${t.rot}deg) scale(${t.scale})`,
        transformOrigin: "top left",
      }}
      onPointerDown={onPointerDownMove}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
    >
      {/* Content */}
      <img
        src={src}
        alt={label}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        draggable={false}
        onLoad={onImgLoad}
      />

      {/* Hover/active border */}
      <div
        className={[
          "absolute inset-0 rounded-md pointer-events-none transition-opacity",
          selected ? "ring-2 ring-sky-400/90 opacity-100" : "ring-2 ring-sky-400/70 opacity-0 group-hover:opacity-100",
        ].join(" ")}
      />

      {/* Only bottom-left resize handle */}
      {["bl"].map((pos) => (
        <Handle key={pos} pos={pos} onPointerDown={onPointerDownScale} />
      ))}

      {/* Rotate handle (top-center) */}
      <RotateHandle onPointerDown={onPointerDownRotate} />
    </div>
  );
}

// Edge+corner handles (uniform scale for simplicity)
function Handle({ pos, onPointerDown }) {
  const baseKnob =
    "absolute z-10 flex items-center justify-center w-7 h-7 -m-3 rounded-md bg-white text-slate-900 border border-slate-700 shadow-lg opacity-0 group-hover:opacity-100";
  const baseEdge =
    "absolute z-10 flex items-center justify-center bg-white/95 text-slate-900 border border-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100";

  // Only bottom-left handle kept
  const map = {
    // tl: { ...removed... },
    // tr: { ...removed... },
    bl: { cls: "bottom-0 left-0 cursor-nesw-resize", type: "knob", rot: -45 },
    // br: { ...removed... },
    // t: { ...removed... },
    // b: { ...removed... },
    // r: { ...removed... },
    // l: { ...removed... },
  };
  const m = map[pos];
  if (!m) return null;

  const Icon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" className="pointer-events-none" aria-hidden="true">
      <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className={(m.type === "knob" ? baseKnob : baseEdge) + " " + m.cls} onPointerDown={onPointerDown} title="Resize">
      <div style={{ transform: `rotate(${m.rot}deg)` }}>
        <Icon />
      </div>
    </div>
  );
}

function RotateHandle({ onPointerDown }) {
  return (
    <>
      {/* connector line */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-sky-400/70 opacity-0 group-hover:opacity-100 pointer-events-none" />
      {/* bigger rotate knob with icon */}
      <div
        className="absolute -top-14 left-1/2 -translate-x-1/2 w-10 h-10 -m-5 rounded-full bg-white text-slate-900 border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center"
        onPointerDown={onPointerDown}
        title="Rotate"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="pointer-events-none">
          <path d="M4 4v6h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 10a8 8 0 10-5.3 7.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </>
  );
}

// Removed old LayeredImage and the left-panel TransformControls

function Reset({ onClick }) {
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">
      Reset
    </button>
  );
}
