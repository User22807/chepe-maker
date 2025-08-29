import MemeFabric from "./components/MemeFabric.jsx";

export default function App() {
  return (
    <div className=" text-slate-100 flex flex-col">
      {/* Navbar */}
      <nav className=" h-14 flex items-center p-[16px] shadow-sm">
        <img
          src="/navicon.png"
          alt="Logo"
          style={{ maxHeight: 30 }}
          className="block"
        />
      </nav>
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <MemeFabric />
      </div>
    </div>
  );
}
