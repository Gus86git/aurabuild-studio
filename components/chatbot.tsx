'use client';
import { useEffect } from 'react';
import { MessageSquare } from "lucide-react";

export function Chatbot() {
  useEffect(() => {
    const scriptInject = document.createElement('script');
    scriptInject.src = 'https://cdn.botpress.cloud/webchat/v3.6/inject.js';
    scriptInject.async = true;
    
    scriptInject.onload = () => {
      const scriptConfig = document.createElement('script');
      scriptConfig.src = 'https://files.bpcontent.cloud/2026/06/18/05/20260618051051-WNP9GQ1Y.js';
      scriptConfig.defer = true;
      document.body.appendChild(scriptConfig);
    };

    document.body.appendChild(scriptInject);
  }, []);

  const handleToggleChat = () => {
    const win = window as any;
    if (win.botpress) {
      win.botpress.open();
    } else if (win.botpressWebChat) {
      win.botpressWebChat.sendEvent({ type: 'show' });
    } else {
      console.log("Cargando chatbot de Botpress...");
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50" suppressHydrationWarning>
      <button 
        className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-full p-4 shadow-lg shadow-cyan-500/20 transition-all duration-300 flex items-center justify-center group"
        onClick={handleToggleChat}
      >
        <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
} 