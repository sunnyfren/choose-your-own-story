const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Top nav
code = code.replace(
  'nav className="fixed top-0 inset-x-0 z-30 flex items-center justify-between px-6 sm:px-8 py-4 sm:py-6 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none"',
  'nav className={`fixed top-0 inset-x-0 z-30 flex items-center justify-between px-6 sm:px-8 py-4 sm:py-6 bg-gradient-to-b pointer-events-none transition-colors duration-[3000ms] ${isDark ? "from-black via-black/80 to-transparent" : "from-white/80 via-white/40 to-transparent"}`}'
);

code = code.replace(
  'className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 font-bold"',
  'className={`text-[10px] uppercase tracking-[0.3em] font-black ${isDark ? "text-red-700" : "text-pink-500"}`}'
);

code = code.replace(
  'className="text-lg sm:text-lg font-light tracking-tight italic"',
  'className={`text-lg sm:text-lg font-bold tracking-tight italic ${isDark ? "text-red-500" : "text-indigo-900"}`}'
);

code = code.replace(
  'className="text-gray-400 hover:text-white transition-colors"',
  'className={`transition-colors flex items-center justify-center p-2 rounded-full ${isDark ? "text-red-900 hover:text-red-500 hover:bg-red-900/20" : "text-indigo-900/40 hover:text-pink-500 hover:bg-pink-100"}`}'
);

code = code.replace(
  'className="text-[10px] uppercase tracking-[0.2em] text-purple-400"',
  'className={`text-[10px] uppercase tracking-[0.2em] font-bold ${isDark ? "text-red-800" : "text-indigo-900/50"}`}'
);

// Map render
code = code.replace(
  'text-[7px] uppercase tracking-[0.3em] text-cyan-600 mb-1',
  'text-[7px] uppercase tracking-[0.3em] mb-1 font-bold ${isDark ? "text-red-900" : "text-pink-400"}'
);

code = code.replace(
  /className=\{`w-1\.5 h-1\.5 sm:w-1\.5 sm:h-1\.5 \$\{isCurrent \? 'bg-cyan-400 shadow-\[0_0_5px_#22d3ee\]' : isVisited \? 'bg-cyan-900\/50' : 'bg-white\/5 border border-white\/5'\}`\}/g,
  'className={`w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 rounded-full transition-all ${isCurrent ? (isDark ? "bg-red-500 shadow-[0_0_5px_red]" : "bg-pink-500 shadow-[0_0_5px_hotpink]") : isVisited ? (isDark ? "bg-red-900/50" : "bg-pink-300") : (isDark ? "bg-black border border-red-900/50" : "bg-white border border-pink-100")}`}'
);

// Footer
code = code.replace(
  'className="fixed bottom-0 inset-x-0 z-30 px-4 sm:px-8 py-3 sm:py-4 flex items-end justify-between bg-gradient-to-t from-black to-transparent pointer-events-none"',
  'className={`fixed bottom-0 inset-x-0 z-30 px-4 sm:px-8 py-3 sm:py-4 flex items-end justify-between pointer-events-none transition-colors duration-[3000ms] ${isDark ? "bg-gradient-to-t from-black to-transparent" : "bg-gradient-to-t from-white/90 to-transparent"}`}'
);

code = code.replace(
  'className="flex flex-col bg-black/60 p-2 rounded border border-white/5 backdrop-blur-md"',
  'className={`flex flex-col p-3 rounded-[20px] border backdrop-blur-3xl shadow-lg border-white/5 ${isDark ? "bg-black/80 border-red-900/30" : "bg-white/80 border-pink-100"}`}'
);

code = code.replace(
  'className="text-[8px] sm:text-[9px] uppercase tracking-wider text-gray-500 mb-1"',
  'className={`text-[8px] sm:text-[9px] uppercase font-bold tracking-wider mb-1 ${isDark ? "text-red-900" : "text-indigo-900/50"}`}'
);

code = code.replace(
  'className="text-[10px] font-mono text-gray-300"',
  'className={`text-[10px] ${isDark ? "text-red-500/80 font-mono" : "text-indigo-900 font-bold"}`}'
);

code = code.replace(
  '<span className="text-purple-400">[{r.status}]</span>',
  '<span className={`${isDark ? "text-red-700" : "text-pink-500"}`}>[{r.status}]</span>'
);

code = code.replace(
  'className="flex items-center gap-4 text-[8px] sm:text-[10px] tracking-widest text-gray-400 pointer-events-auto drop-shadow-md"',
  'className={`flex items-center gap-4 text-[8px] sm:text-[10px] font-black tracking-widest pointer-events-auto drop-shadow-md ${isDark ? "text-red-900" : "text-indigo-900/40"}`}'
);

code = code.replace(
  '<div className="w-1 h-1 bg-cyan-400 animate-pulse"></div>',
  '<div className={`w-1.5 h-1.5 animate-[pulse_2s_ease-in-out_infinite] rounded-full ${isDark ? "bg-red-600 shadow-[0_0_5px_red]" : "bg-pink-400 shadow-[0_0_5px_hotpink]"}`}></div>'
);

code = code.replace(
  '<div className="mt-8 flex items-center justify-center gap-2 cursor-pointer pointer-events-auto text-gray-500 hover:text-gray-300" onClick={toggleAudio}>',
  '<div className={`mt-8 flex items-center justify-center gap-2 cursor-pointer pointer-events-auto transition-colors font-bold ${isDark ? "text-red-900 hover:text-red-600" : "text-indigo-900/40 hover:text-pink-500"}`} onClick={toggleAudio}>'
);

// Progress Bar fixes
code = code.replace(
  'className="w-full h-1 bg-gray-800 mt-1"',
  'className={`w-full h-1.5 mt-1 rounded-full overflow-hidden ${isDark ? "bg-red-950" : "bg-pink-100"}`}'
);

code = code.replace(
  'className={`h-full transition-all duration-1000 ${gameState.sanity < 30 ? \'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]\' : \'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]\'}`}',
  'className={`h-full transition-all duration-1000 ${isDark ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]" : "bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.8)]"}`}'
);


fs.writeFileSync('src/App.tsx', code);
console.log('fix_nav applied!');
