
import React, { useEffect, useState } from 'react';
import { AgentMode, AGENTS } from '../types';
import { Radio, Wifi } from 'lucide-react';

interface IncomingTransmissionProps {
  targetAgent: AgentMode;
}

export const IncomingTransmission: React.FC<IncomingTransmissionProps> = ({ targetAgent }) => {
  const agentConfig = AGENTS[targetAgent];
  const [decodedName, setDecodedName] = useState('');
  const [imgError, setImgError] = useState(false);
  const fullName = agentConfig.name;
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDecodedName(
        fullName
          .split('')
          .map((letter, index) => {
            if (index < iteration) {
              return letter;
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('')
      );

      if (iteration >= fullName.length) {
        clearInterval(interval);
      }

      iteration += 1 / 3;
    }, 30);

    return () => clearInterval(interval);
  }, [fullName]);

  return (
    <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center overflow-hidden">
      {imgError ? (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-purple-900/10 via-black to-cyan-900/10" />
      ) : (
        <img
          src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExODF5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7qE1YN7aQf3rfWVE/giphy.gif"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-5 pointer-events-none"
          onError={() => setImgError(true)}
        />
      )}
      
      {/* Central Hud */}
      <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-md p-8">
        
        {/* Incoming Call Header */}
        <div className="flex flex-col items-center">
             <span className="text-nexus-accent text-xs font-mono tracking-[0.5em] mb-2 animate-pulse">SECURE LINE</span>
             <h1 className="text-4xl font-mono font-bold text-white tracking-wider animate-pulse-fast">INCOMING</h1>
        </div>

        {/* Main Icon Ring */}
        <div className="relative group">
             <div className={`absolute inset-0 rounded-full border-2 ${agentConfig.color.replace('text-', 'border-')} animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-50`}></div>
             <div className={`absolute inset-0 rounded-full border-2 ${agentConfig.color.replace('text-', 'border-')} animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] delay-500 opacity-30`}></div>
             <div className={`relative z-10 w-32 h-32 rounded-full bg-nexus-900 border-4 ${agentConfig.color.replace('text-', 'border-')} flex items-center justify-center shadow-[0_0_50px_rgba(0,255,157,0.2)]`}>
                 <Radio size={48} className={`${agentConfig.color} animate-bounce`} />
             </div>
        </div>

        <div className="text-center space-y-2 h-16">
          <h2 className={`text-xl font-mono font-bold ${agentConfig.color} tracking-widest uppercase`}>
            {decodedName}
          </h2>
          <div className="flex items-center justify-center gap-2 text-nexus-dim font-mono text-xs">
            <Wifi size={12} className="animate-pulse" />
            <span>HANDSHAKE PROTOCOL INITIALIZED</span>
          </div>
        </div>

        {/* Audio Waveform Simulation */}
        <div className="flex items-center justify-center gap-1 h-12 w-full">
            {[...Array(20)].map((_, i) => (
                <div 
                    key={i} 
                    className={`w-1.5 bg-nexus-accent/80 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_alternate] transition-all duration-75`}
                    style={{ 
                        height: `${10 + Math.random() * 90}%`,
                        animationDelay: `${i * 0.05}s`,
                        opacity: Math.random() > 0.5 ? 1 : 0.4
                    }}
                />
            ))}
        </div>

        {/* Loading Bar */}
        <div className="w-64 space-y-1">
             <div className="flex justify-between text-[10px] text-nexus-accent font-mono">
                <span>BUFFERING AGENT CONTEXT...</span>
                <span className="animate-pulse">100%</span>
             </div>
             <div className="h-1 bg-nexus-900 w-full overflow-hidden rounded-full">
                <div className="h-full bg-nexus-accent animate-[width_2s_ease-in-out_infinite]" style={{ width: '100%' }}></div>
             </div>
        </div>

      </div>

      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_4px,6px_100%]"></div>
    </div>
  );
};
