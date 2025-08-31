import { useEffect, useRef, useState } from "react";
import { Canvas, Image as FabricImage, FabricObject } from "fabric";
import ReactH5AudioPlayer, { RHAP_UI } from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
const CANVAS_SIZE = 500;

// Local background assets
const BACKGROUNDS = [
  "/backgrounds/bg-1.jpg",
  "/backgrounds/bg-2.jpg",
  "/backgrounds/bg-3.jpg",
  "/backgrounds/bg-4.jpg",
  "/backgrounds/bg-5.jpg",
  "/backgrounds/bg-6.jpg",
  "/backgrounds/bg-7.jpg",
];

// Local Chepe assets (PNG with transparency recommended)
const CHEPE_IMAGES = [
  "/chepe/chepe-2.png",
  "/chepe/chepe-3.png",
  "/chepe/chepe-4.png",
];
const CHEPE_BODIES = [
  "/chepe/bodies/body-1.png",
  "/chepe/bodies/body-2.png",
  "/chepe/bodies/body-3.png",
];
const CHEPE_HEADS = [
  "/chepe/heads/head-1.png",
  "/chepe/heads/head-2.png",
  "/chepe/heads/head-3.png",
];

// 🔹 Set this to your actual default character image path
const DEFAULT_USER_IMAGE = "/assets/guest-default.png";

export default function MemeFabric() {
  const canvasElRef = useRef(null);
  const canvasRef = useRef(null);
  const bgObjRef = useRef(null);
  const userFileInputRef = useRef(null);
  const chepeBodyRef = useRef(null);
  const chepeHeadRef = useRef(null);

  const [userObj, setUserObj] = useState(null);
  const [chepeObj, setChepeObj] = useState(null);
  const [userThumbSrc, setUserThumbSrc] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  // for "Upload background" button
  const bgFileInputRef = useRef(null);
  // -------- Layers list (UI) --------
  const [layersUI, setLayersUI] = useState([]); // top-most first
  const idCounterRef = useRef(1);

  function assignIdAndMeta(obj, customType, src) {
    obj.set({
      _id: obj._id || `obj_${idCounterRef.current++}`,
      _src: src || obj._src,
      _type: customType, // 'background' | 'user' | 'chepe'
    });
  }

  function prettyName(o) {
    if (o._type === "background") return "Background";
    if (o._type === "user") return "Your character";
    if (o._type === "chepe-body") return "Chepe Body";
    if (o._type === "chepe-head") return "Chepe Head";
    if (o._type === "chepe") return "Chepe";
    return "Layer";
  }

  function refreshLayersUI() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects(); // bottom -> top
    const active = canvas.getActiveObject();
    setActiveId(active?._id ?? null);

    const list = objs.map((o, index) => ({
      id: o._id,
      label: prettyName(o),
      index,
      src: o._src,
      isBg: o._type === "background",
    }));
    setLayersUI(list.reverse()); // show top-most first
  }

  function getObjectById(id) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getObjects().find(o => o._id === id) || null;
  }

  // --- Safe reordering for Fabric v6 ---
  function moveObjectToIndex(canvas, obj, targetIndex) {
    if (typeof obj.moveTo === "function") {
      obj.moveTo(targetIndex);
      return;
    }
    const list = canvas._objects;
    const from = list.indexOf(obj);
    if (from === -1 || from === targetIndex) return;
    list.splice(from, 1);
    list.splice(targetIndex, 0, obj);
    canvas.requestRenderAll();
  }

  function moveLayer(id, direction) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const objs = canvas.getObjects(); // bottom -> top
    const obj = getObjectById(id);
    if (!obj) return;

    const curIdx = objs.indexOf(obj);
    if (curIdx < 0) return;

    const isBg = obj === bgObjRef.current;
    const topIdx = objs.length - 1;
    const minIdx = bgObjRef.current ? 1 : 0; // never below background if it exists

    let target = curIdx;

    if (direction === "up") {
      target = Math.min(topIdx, curIdx + 1);
    } else if (direction === "down") {
      target = Math.max(isBg ? 0 : minIdx, curIdx - 1);
    }

    if (isBg) target = 0; // lock background

    if (target === curIdx) return;

    moveObjectToIndex(canvas, obj, target);
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    refreshLayersUI();
  }

  function selectLayer(id) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = getObjectById(id);
    if (!obj) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    refreshLayersUI();
  }

  // -------- Init Fabric --------
  useEffect(() => {
    const canvas = new Canvas(canvasElRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: "#0f172a",
      preserveObjectStacking: true,
      selection: true,
    });

    // Sync layers UI with selection/changes
    const onSelection = () => refreshLayersUI();
    canvas.on("selection:created", onSelection);
    canvas.on("selection:updated", onSelection);
    canvas.on("selection:cleared", onSelection);
    canvas.on("object:modified", onSelection);
    canvas.on("object:added", onSelection);
    canvas.on("object:removed", onSelection);

    canvasRef.current = canvas;

    // bump scene version; capture this mount's token
    const myVersion = ++sceneVersionRef.current;

    (async () => {
      try {
        // start clean for this mount
        clearScene();

        // 1) random background
        const bgPick = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
        await setBackgroundFromURL(bgPick);
        if (sceneVersionRef.current !== myVersion) return; // canceled

        // 2) default character
        if (DEFAULT_USER_IMAGE) {
          await addUserFromURL(DEFAULT_USER_IMAGE);
          if (sceneVersionRef.current !== myVersion) return;
        }

        // 3) Add one random Chepe Body and one random Chepe Head (head above body)
        const bodyPick = CHEPE_BODIES[Math.floor(Math.random() * CHEPE_BODIES.length)];
        const headPick = CHEPE_HEADS[Math.floor(Math.random() * CHEPE_HEADS.length)];
        await setChepeBodyFromURL(bodyPick);
        if (sceneVersionRef.current !== myVersion) return;
        await setChepeHeadFromURL(headPick);
        if (sceneVersionRef.current !== myVersion) return;
      } finally {
        refreshLayersUI();
      }
    })();

    return () => {
      ++sceneVersionRef.current; // invalidate in-flight
      canvas.dispose();
      canvasRef.current = null;
      bgObjRef.current = null;
      canvas.off("selection:created", onSelection);
      canvas.off("selection:updated", onSelection);
      canvas.off("selection:cleared", onSelection);
      canvas.off("object:modified", onSelection);
      canvas.off("object:added", onSelection);
      canvas.off("object:removed", onSelection);
    };
  }, []);

  // -------- Helpers --------
  function fileToDataURL(file) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
    });
  }

  // cancel token for any in-flight boot steps
  const sceneVersionRef = useRef(0);
  const isApplyingRef = useRef(false); // still used to gate some async ops if needed

  function removeAllOfType(type) {
    const c = canvasRef.current; if (!c) return;
    c.getObjects().filter(o => o._type === type).forEach(o => c.remove(o));
  }
  function clearScene(types = ["background", "user", "chepe"]) {
    const c = canvasRef.current; if (!c) return;
    c.getObjects().filter(o => types.includes(o._type)).forEach(o => c.remove(o));
    if (types.includes("user")) {
      setUserObj(null);
      setUserThumbSrc(null);
    }
    if (types.includes("background")) bgObjRef.current = null;
    c.requestRenderAll();
  }

  function fitBackground(img) {
    const cw = CANVAS_SIZE, ch = CANVAS_SIZE;
    const ir = img.width / img.height;
    const cr = cw / ch;
    let w = cw, h = ch;
    if (ir > cr) { h = ch; w = h * ir; } else { w = cw; h = w / ir; }
    const scaleX = w / img.width;
    const scaleY = h / img.height;
    const left = (cw - w) / 2;
    const top = (ch - h) / 2;
    return { scaleX, scaleY, left, top };
  }

  async function setBackgroundFromFile(file) {
    const dataUrl = await fileToDataURL(file);
    await setBackgroundFromURL(dataUrl);
  }

  // v6: background is a locked image at the back (index 0, always)
  async function setBackgroundFromURL(url) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isApplyingRef.current = true;
    try {
      removeAllOfType("background");

      const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      const { scaleX, scaleY, left, top } = fitBackground(img);

      img.set({
        left,
        top,
        originX: "left",
        originY: "top",
        scaleX,
        scaleY,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      });
      assignIdAndMeta(img, "background", url);

      canvas.add(img);
      if (typeof img.moveTo === "function") img.moveTo(0);
      else {
        const objs = canvas._objects;
        const i = objs.indexOf(img);
        if (i > -1) { objs.splice(i, 1); objs.splice(0, 0, img); }
      }

      bgObjRef.current = img;
      canvas.requestRenderAll();
    } finally {
      isApplyingRef.current = false;
    }

    refreshLayersUI();
  }

  function clearBackground() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (bgObjRef.current) {
      canvas.remove(bgObjRef.current);
      bgObjRef.current = null;
      canvas.requestRenderAll();
      refreshLayersUI();
    }
  }

  // add a normal layer (user/chepe)
  async function addImageLayer(url, opts = {}) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });

    const maxSide = CANVAS_SIZE * 0.45;
    const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);

    img.set({
      left: CANVAS_SIZE * (opts.centerX ?? 0.5),
      top: CANVAS_SIZE * (opts.centerY ?? 0.5),
      originX: "center",
      originY: "center",
      selectable: true,
      hasControls: true,
      hasBorders: true,
      lockScalingFlip: true,
      hoverCursor: "move",
    });
    assignIdAndMeta(img, opts.type || "layer", url);

    img.scale(scale);
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();

    refreshLayersUI();

    if (opts.onReady) opts.onReady(img);
    return img;
  }

  // 🔹 load default user from URL (similar to Chepe)
  async function addUserFromURL(url) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    removeAllOfType("user");
    const obj = await addImageLayer(url, { centerX: 0.38, centerY: 0.5, type: "user" });
    setUserObj(obj);
    setUserThumbSrc(url);
  }

  async function addUserFromFile(file) {
    const url = await fileToDataURL(file);
    await addUserFromURL(url);
  }

  // NEW: helpers to set/replace body/head
  async function setChepeBodyFromURL(url, opts = {}) {
    const canvas = canvasRef.current; if (!canvas) return;
    if (chepeBodyRef.current) canvas.remove(chepeBodyRef.current);
    const body = await addImageLayer(url, {
      centerX: opts.centerX ?? 0.62,
      centerY: opts.centerY ?? 0.58,
      type: "chepe-body",
    });
    chepeBodyRef.current = body;
    // Make sure body is below head if head exists
    if (chepeHeadRef.current) {
      const objs = canvas.getObjects();
      const bodyIndex = objs.indexOf(body);
      const headIndex = objs.indexOf(chepeHeadRef.current);
      if (headIndex <= bodyIndex) {
        moveObjectToIndex(canvas, chepeHeadRef.current, bodyIndex + 1);
      }
    }
    canvas.requestRenderAll();
    refreshLayersUI();

    // Always ensure body is below head
    if (chepeBodyRef.current && chepeHeadRef.current) {
      const objs = canvas.getObjects();
      const bodyIndex = objs.indexOf(chepeBodyRef.current);
      const headIndex = objs.indexOf(chepeHeadRef.current);

      // Move body below head
      if (bodyIndex > -1 && headIndex > -1 && bodyIndex > headIndex) {
        moveObjectToIndex(canvas, chepeBodyRef.current, headIndex);
        moveObjectToIndex(canvas, chepeHeadRef.current, headIndex + 1);
        canvas.requestRenderAll();
      }
    }
  }

  async function setChepeHeadFromURL(url, opts = {}) {
    const canvas = canvasRef.current; if (!canvas) return;
    if (chepeHeadRef.current) canvas.remove(chepeHeadRef.current);

    // Default placement: over body if exists
    let cx = 0.62, cy = 0.45;
    if (chepeBodyRef.current) {
      cx = chepeBodyRef.current.left / CANVAS_SIZE;
      cy = chepeBodyRef.current.top / CANVAS_SIZE - 0.28;
    }
    const head = await addImageLayer(url, {
      centerX: opts.centerX ?? cx,
      centerY: opts.centerY ?? cy,
      type: "chepe-head",
    });

    // Scale head to 1/3 of its current size
    head.scale(head.scaleX * (1 / 2));

    chepeHeadRef.current = head;
    // Ensure head sits above body
    if (chepeBodyRef.current) {
      if (typeof canvas.bringToFront === "function") {
        canvas.bringToFront(head);
      }
    }
    canvas.requestRenderAll();
    refreshLayersUI();
  }

  // Add this helper:
  function groupChepeParts() {
    const canvas = canvasRef.current;
    if (!canvas || !chepeBodyRef.current || !chepeHeadRef.current) return;
    // Remove individual objects from canvas
    canvas.remove(chepeBodyRef.current);
    canvas.remove(chepeHeadRef.current);
    // Create group: body first, then head (so head is above)
    const group = new fabric.Group([chepeBodyRef.current, chepeHeadRef.current], {
      left: CANVAS_SIZE * 0.62,
      top: CANVAS_SIZE * 0.58,
      originX: "center",
      originY: "center",
    });
    assignIdAndMeta(group, "chepe-group");
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    // Optionally: store group ref if you want to manipulate later
  }

  // Update removeLayer to clear refs
  function removeLayer(id) {
    const c = canvasRef.current;
    if (!c) return;
    const obj = getObjectById(id);
    if (!obj) return;

    if (obj === bgObjRef.current) bgObjRef.current = null;
    if (obj === userObj || obj._type === "user") {
      setUserObj(null);
      setUserThumbSrc(null);
    }
    if (obj === chepeObj) setChepeObj(null);
    // NEW: clear chepe body/head refs when those are removed
    if (obj === chepeBodyRef.current || obj._type === "chepe-body") chepeBodyRef.current = null;
    if (obj === chepeHeadRef.current || obj._type === "chepe-head") chepeHeadRef.current = null;

    c.remove(obj);
    c.discardActiveObject();
    c.requestRenderAll();
    refreshLayersUI();
  }

  async function addChepeFromURL(url) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const obj = await addImageLayer(url, {
      centerX: 0.62,
      centerY: 0.58,
      type: "chepe",
    });

    setChepeObj(obj);
    refreshLayersUI();
  }

  function exportPNG(multiplier = 1) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prevActive = canvas.getActiveObject();
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    const prevBgColor = canvas.backgroundColor;
    if (!bgObjRef.current) {
      canvas.backgroundColor = "rgba(0,0,0,0)";
    }

    const dataURL = canvas.toDataURL({ format: "png", multiplier });

    canvas.backgroundColor = prevBgColor;
    if (prevActive) canvas.setActiveObject(prevActive);
    canvas.requestRenderAll();

    const a = document.createElement("a");
    a.href = dataURL;
    a.download = "chepe-meme.png";
    a.click();
  }

  // -------- UI --------
  return (
    <div className="text-[#ffffff] bg-[#19203F] p-[12px] rounded-[20px] flex justify-center">
      <div className=" flex  gap-[14px] ">
        <div className=" flexflex-col justify-between">
          {/* Top group */}
          <div className="space-y-3  flex flex-col h-full items-center justify-center">
            {/* User PNG */}
            <div className=" flex flex-col items-center bg-[#212A50] p-[12px] rounded-[20px] p-2 ">

              {/* 120×120 preview that opens the file picker on click */}
              <div
                role="button"
                tabIndex={0}
                title="Click to change character"
                onClick={() => userFileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && userFileInputRef.current?.click()}
                className="h-[120px] w-[120px] rounded-md  overflow-hidden
             hover:bg-white/10 cursor-pointer transition grid place-items-center"
              >
                {userThumbSrc ? (
                  <img
                    src={userThumbSrc}
                    alt="Your character preview"
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <span className="text-[11px] uppercase tracking-wide opacity-70 select-none">
                    Upload
                  </span>

                )}

              </div>
              <div className="text-xs font-medium opacity-80">Your character</div>

              {/* hidden input — triggered by clicking the preview */}
              <input
                ref={userFileInputRef}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && addUserFromFile(e.target.files[0])}
              />
            </div>

            {/* Layers at the bottom */}
            <div className="mt-auto rounded-xl bg-[#212A50] rounded-[20px] p-[10px] space-y-1">
              <div className="text-[12px] text-[#ccc] mb-[14px] font-medium opacity-80">Layers</div>
              {layersUI.length === 0 && (
                <div className="text-[11px]  opacity-70">No layers yet</div>
              )}
              {layersUI.map((layer) => {
                const isActive = layer.id === activeId;
                return (
                  <div
                    key={layer.id}
                    className={`flex items-center justify-between  rounded  ${isActive ? "bg-blue-500/30" : ""}`}
                    style={isActive ? { backgroundColor: "rgba(96,165,250,0.3)" } : undefined}
                  >
                    <button
                      className="text-[11px] border-none text-[#fff] px-[12px] py-[6px] rounded bg-transparent hover:bg-[#ffffff40] cursor-pointer"
                      title={`Index: ${layer.index}`}
                      onClick={() => selectLayer(layer.id)}
                    >
                      {layer.label}
                    </button>

                    {!layer.isBg && (
                      <div className="flex items-center gap-1">
                        <button
                          className="text-[11px] border-none text-[#fff] px-[12px] py-[6px] rounded bg-transparent hover:bg-[#ffffff40] cursor-pointer"
                          title="Move up (toward front)"
                          onClick={() => moveLayer(layer.id, "up")}
                        >
                          ↑
                        </button>
                        <button
                          className="text-[11px] border-none text-[#fff] px-[12px] py-[6px] rounded bg-transparent hover:bg-[#ffffff40] cursor-pointer"
                          title="Remove layer"
                          onClick={() => removeLayer(layer.id)}
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* --- Use react-h5-audio-player for streaming/buffering --- */}
            <div style={{ zIndex: 10, width: 170 }}>
              <ReactH5AudioPlayer
                src="/music/background.mp3"
                showJumpControls={false}
                customAdditionalControls={[]} // No extra controls
                customVolumeControls={[]} // Hide volume controls
                showFilledProgress={true}
                showDownloadProgress={false}
                layout="horizontal-reverse"
                onPlay={() => setIsMusicPlaying(true)}
                onPause={() => setIsMusicPlaying(false)}
                customProgressBarSection={[
                  RHAP_UI.MAIN_CONTROLS,
                  RHAP_UI.PROGRESS_BAR,
                ]}
                customControlsSection={[]}
                style={{
                  background: "transparent",
                  boxShadow: "none",
                  paddingLeft: 0,
                  paddingRight: 0,
                }}
                className="!bg-transparent !shadow-none !pl-0 !pr-0 custom-audio-player"
              />
              <style>
                {`
                  .custom-audio-player .rhap_container {
                    background: transparent !important;
                    box-shadow: none !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                  }
                  .custom-audio-player .rhap_main-controls {
                    margin-left: 0 !important;
                  }
                  .custom-audio-player .rhap_controls-section {
                    margin-left: 0 !important;
                  }
                  .custom-audio-player .rhap_play-pause-button {
                    margin-left: 0 !important;
                  }
                `}
              </style>
            </div>
            {/* --- End music player --- */}
          </div>

        </div>

        {/* Center: Canvas frame + BG picker row */}
        <div className=" w-[500px] flex flex-col gap-[14px] justify-between h-full">
          {/* Tiny helper text */}

          {/* Canvas */}
          <div className=" flex rounded-[14px] items-center justify-center overflow-hidden">
            <canvas ref={canvasElRef} className="rounded-lg shadow-2xl" />
          </div>




          {/* Background picker row */}
          <div className=" bg-[#212A50] rounded-[20px] p-[12px] ">
            {/* Upload + Transparent */}
            <div className="flex items-center   gap-2 overflow-x-auto">
              {BACKGROUNDS.map((src) => (
                <button
                  key={src}
                  title={src}
                  onClick={() => setBackgroundFromURL(src)}
                  className="group relative bg-transparent border-none flex-none rounded-md overflow-hidden hover:bg-[#fff] focus:outline-none"
                  style={{ width: 80, height: 80 }}
                >
                  <img
                    src={src}
                    alt="bg"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                    draggable={false}
                  />
                </button>
              ))}
            </div>

            <div className="mt-2 flex justify-center">
              <div className="flex mt-[20px] gap-[24px]">
                <button
                  className="px-[4px] py-[4px] text-xs rounded-[8px] text-[#fff] bg-[#ffffff30] hover:bg-[#ffffff50] rounded border-transparent cursor-pointer"
                  onClick={() => bgFileInputRef.current?.click()}
                >
                  Upload background
                </button>
                <button
                  className="px-[4px] py-[4px] text-xs rounded-[8px] text-[#fff] bg-[#ffffff30] hover:bg-[#ffffff50] rounded border-transparent cursor-pointer"
                  onClick={clearBackground}
                  title="Remove background image; export will be transparent"
                >
                  Transparent
                </button>
              </div>

              <input
                ref={bgFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && setBackgroundFromFile(e.target.files[0])}
              />
            </div>
          </div>
        </div>

        {/* Right: Vertical Chepe picker*/}
        <div className="flex flex-col h-full">
          {/* Chepe Head vertical carousel */}
          <div className="text-xs bg-[#212A50] rounded-[20px] font-semibold tracking-wide py-[12px] text-center mt-4 flex flex-col items-center">
            <ChepeCarousel
              images={CHEPE_HEADS}
              onPick={setChepeHeadFromURL}
              alt="head"
            />
          </div>
          {/* Chepe Body vertical carousel */}
          <div className="text-xs bg-[#212A50] rounded-[20px] font-semibold tracking-wide py-[12px] text-center flex flex-col items-center">
            <ChepeCarousel
              images={CHEPE_BODIES}
              onPick={setChepeBodyFromURL}
              alt="body"
            />
          </div>


          {/* Export at the bottom */}
          <div className="mt-auto items-center rounded-xl bg-[#212A50] p-[12px] rounded-[20px] gap-[20px]">
            <div className="text-xs font-medium opacity-80">Export</div>
            <div className="grid grid-cols-2 gap-[8px] mt-[20px]">
              <button
                onClick={() => exportPNG(1)}
                className="px-[8px] py-[8px] text-xs rounded-[12px] text-[#fff] bg-[#ffffff30] hover:bg-[#ffffff50] rounded border-transparent cursor-pointer"
              >
                PNG 1×
              </button>
              <button
                onClick={() => exportPNG(2)}
                className="px-[8px] py-[8px] text-xs rounded-[12px] text-[#fff] bg-[#ffffff30] hover:bg-[#ffffff50] rounded border-transparent cursor-pointer"
              >
                PNG 2×
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChepeCarousel({ images, onPick, alt }) {
  const [index, setIndex] = useState(0);
  const max = images.length - 1;
  return (
    <div style={{ width: 96, margin: "0 auto" }} className="flex flex-col items-center mt-2">
      <button
        aria-label="Previous"
        className="mb-2 text-lg px-2 py-1 rounded bg-[#1e293b] hover:bg-[#334155] text-white"
        onClick={() => setIndex(i => (i === 0 ? max : i - 1))}
        style={{ width: 32 }}
      >▲</button>
      <button
        className="group relative w-full aspect-square rounded-md focus:outline-none"
        style={{ maxWidth: 96 }}
        onClick={() => onPick(images[index])}
      >
        <img
          src={images[index]}
          alt={alt}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </button>
      <button
        aria-label="Next"
        className="mt-2 text-lg px-2 py-1 rounded bg-[#1e293b] hover:bg-[#334155] text-white"
        onClick={() => setIndex(i => (i === max ? 0 : i + 1))}
        style={{ width: 32 }}
      >▼</button>
      <div className="text-[11px] mt-1 opacity-60">{index + 1} / {images.length}</div>
    </div>
  );
}
