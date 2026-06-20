'use client';
import { MessageSquare } from "lucide-react";

export function Chatbot() {
  return (
    <div className="fixed bottom-6 right-6 z-50" suppressHydrationWarning>
      <button 
        className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-full p-4 shadow-lg shadow-cyan-500/20 transition-all duration-300 flex items-center justify-center group"
        onClick={() => alert("Asistente AI de AuraBuild próximamente disponible.")}
      >
        <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
} 