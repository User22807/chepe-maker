import useLocalStorage from "../hooks/useLocalStorage";

export default function AdminPanel() {
  const [poses, setPoses] = useLocalStorage("chepePoses", []);

  function onUploadChepe(e) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPoses((prev) => [
          ...prev,
          { id: crypto.randomUUID(), name: file.name, dataUrl: reader.result },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removePose(id) {
    setPoses((prev) => prev.filter((p) => p.id !== id));
  }

  function seedDemo() {
    // Optionally seed with a demo chepe silhouette (user will replace).
    const demo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAA..."; // (optional tiny placeholder)
    setPoses((prev) => [...prev, { id: crypto.randomUUID(), name: "demo-chepe.png", dataUrl: demo }]);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <h2 className="text-lg font-semibold">Add Chepe Poses</h2>
        <input
          type="file"
          accept="image/png"
          multiple
          onChange={onUploadChepe}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
        />
        <button
          onClick={seedDemo}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
        >
          Add demo placeholder
        </button>
        <p className="text-xs text-slate-400">
          Tip: Upload transparent PNGs of Chepe (various poses).
        </p>
      </div>

      <div className="md:col-span-2">
        <h3 className="font-medium mb-3">Current Chepe Poses ({poses.length})</h3>
        {poses.length === 0 && (
          <div className="text-slate-400 text-sm">No poses yet. Upload PNGs on the left.</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {poses.map((p) => (
            <div key={p.id} className="bg-slate-800 rounded-xl p-3">
              <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                <img src={p.dataUrl} alt={p.name} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs truncate">{p.name}</span>
                <button
                  onClick={() => removePose(p.id)}
                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
