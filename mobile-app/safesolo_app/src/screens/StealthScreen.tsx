import { useState } from "react";
import { useApp } from "@/state/AppState";

/**
 * Decoy Calculator - Chế độ ẩn danh.
 * Nhập đúng "1909=" để mở giao diện thật.
 */
export default function StealthScreen() {
  const { setSecurity } = useApp();
  const [display, setDisplay] = useState("0");

  const press = (k: string) => {
    if (k === "C") return setDisplay("0");
    if (k === "=") {
      if (display === "1909") {
        // Mở khóa giao diện thật
        setSecurity({ stealthMode: false });
        return;
      }
      try {
        // eslint-disable-next-line no-eval
        const v = eval(display.replace(/×/g, "*").replace(/÷/g, "/"));
        setDisplay(String(v));
      } catch {
        setDisplay("Error");
      }
      return;
    }
    setDisplay((d) => (d === "0" || d === "Error" ? k : d + k));
  };

  const keys = [
    "C", "÷", "×", "⌫",
    "7", "8", "9", "-",
    "4", "5", "6", "+",
    "1", "2", "3", "=",
    "0", ".",
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 flex items-end justify-end p-6">
        <p className="text-6xl font-light truncate">{display}</p>
      </div>
      <div className="grid grid-cols-4 gap-px bg-zinc-800">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => {
              if (k === "⌫") return setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : "0"));
              press(k);
            }}
            className={`h-20 text-2xl font-light transition-colors ${
              ["÷","×","-","+","="].includes(k)
                ? "bg-orange-500 active:bg-orange-400"
                : ["C","⌫"].includes(k)
                ? "bg-zinc-600 active:bg-zinc-500"
                : "bg-zinc-900 active:bg-zinc-800"
            } ${k === "0" ? "col-span-2" : ""}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
