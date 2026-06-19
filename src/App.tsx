import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Volume2, VolumeX, Radio, BookOpen } from "lucide-react";
import type {
  StoryNode,
  HistoryTurn,
  Choice,
  GameState,
  StoryMeta,
} from "./types";
import {
  initAudio,
  setToneConfig,
  stopAudio,
  triggerAudioHallucination,
} from "./audio";

type AppState = "splash" | "menu" | "playing";

export default function App() {
  const [appState, setAppState] = useState<AppState>("splash");
  const [showJournal, setShowJournal] = useState(false);
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const activeStoryIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeStoryIdRef.current = activeStoryId;
  }, [activeStoryId]);

  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const [currentNode, setCurrentNode] = useState<StoryNode | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    sanity: 100,
    lucidity: 50,
    nostalgia: 80,
    relationships: [],
    inventory: [],
    position: { x: 0, y: 0 },
    visited: [{ x: 0, y: 0 }],
  });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [flashWhite, setFlashWhite] = useState(false);
  const [hoverGaslightId, setHoverGaslightId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [unlockedBadges, setUnlockedBadges] = useState<Record<string, string[]>>({});
  const [newBadgeNotification, setNewBadgeNotification] = useState<{ badge: string, storyId: string } | null>(null);
  const [savedSession, setSavedSession] = useState<any>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (newBadgeNotification) {
      const timer = setTimeout(() => setNewBadgeNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [newBadgeNotification]);

  // Fetch stories on mount
  useEffect(() => {
    fetch("/api/stories")
      .then((res) => res.json())
      .then((data) => {
        setStories(data);
        
        // Load badges
        const loadedBadges: Record<string, string[]> = {};
        data.forEach((st: StoryMeta) => {
          const saved = localStorage.getItem(`rsim_badges_${st.id}`);
          if (saved) {
            try { loadedBadges[st.id] = JSON.parse(saved); } catch (e) {}
          }
          
          // Retroactive fix: if they completed it before badges existed
          const isCompleted = localStorage.getItem(`rsim_completed_${st.id}`);
          if (isCompleted && (!loadedBadges[st.id] || loadedBadges[st.id].length === 0)) {
            loadedBadges[st.id] = ["Story Completed"];
            localStorage.setItem(`rsim_badges_${st.id}`, JSON.stringify(loadedBadges[st.id]));
          }
        });
        setUnlockedBadges(loadedBadges);

        const savedFile = localStorage.getItem("rsim_save");
        if (savedFile) {
          try {
             setSavedSession(JSON.parse(savedFile));
          } catch(e) {}
        }
      })
      .catch((err) => {
        console.error("Failed to load stories", err);
      });
  }, []);

  const loadingMessage = useMemo(() => {
    const msgs = [
      "Good morning...",
      "Good night...",
      "Would you like a cup of tea?",
      "Am I dreaming?",
      "Are you still there?",
      "Is it cold in here?",
      "Hello?",
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }, [loading]);

  useEffect(() => {
    if (
      audioEnabled &&
      currentNode &&
      appState === "playing" &&
      activeStoryId
    ) {
      setToneConfig(currentNode.musicTone, gameState.sanity, activeStoryId);
    } else {
      stopAudio();
    }

    // Stop speech when node changes
    setIsSpeaking(false);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [currentNode, audioEnabled, gameState.sanity, appState, activeStoryId]);

  useEffect(() => {
    if (
      audioEnabled &&
      appState === "playing" &&
      !loading &&
      gameState.sanity < 40
    ) {
      const interval = setInterval(
        () => {
          // Random chance to trigger a disturbing spike while sitting idle
          if (Math.random() < 0.25) {
            triggerAudioHallucination();
          }
        },
        5000 + Math.random() * 5000,
      ); // every 5-10s check
      return () => clearInterval(interval);
    }
  }, [audioEnabled, appState, loading, gameState.sanity]);

  const toggleAudio = () => {
    if (!audioEnabled) initAudio();
    setAudioEnabled(!audioEnabled);
  };

  const readAloud = () => {
    if (!currentNode || !("speechSynthesis" in window)) return;

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = currentNode.narrative;
    const utterance = new SpeechSynthesisUtterance(text);

    const speakSequence = () => {
      const voices = window.speechSynthesis.getVoices();
      const britishMale =
        voices.find(
          (v) =>
            (v.name.includes("UK") || v.lang === "en-GB") &&
            v.name.includes("Male"),
        ) ||
        voices.find((v) => v.lang === "en-GB") ||
        voices.find((v) => v.name.includes("Male")) ||
        voices[0];

      if (britishMale) utterance.voice = britishMale;

      utterance.rate = 0.85;
      utterance.pitch = 0.1;
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speakSequence();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      speakSequence();
    }
  };

  const fetchNextNode = async (
    currentHistory: HistoryTurn[],
    currentState: GameState,
    currentStoryId: string,
  ) => {
    setLoading(true);
    setError(null);

    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    let lastErrorMsg = "";

    while (attempt < maxRetries && !success) {
      try {
        const res = await fetch("/api/story/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: currentHistory,
            currentState,
            storyId: currentStoryId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error || "Failed to conjure the next fragment.",
          );
        }

        const data: StoryNode = await res.json();
        
        if (activeStoryIdRef.current !== currentStoryId) {
           return;
        }

        setCurrentNode(data);
        if (data.gameState) {
          setGameState((prev) => ({
            ...data.gameState,
            visited: [...(prev.visited || []), data.gameState.position],
          }));
        }

        if (data.isEnding && data.endingBadge) {
          setUnlockedBadges((prev) => {
             const storyBadges = prev[currentStoryId] || [];
             if (!storyBadges.includes(data.endingBadge!)) {
                const updated = [...storyBadges, data.endingBadge!];
                localStorage.setItem(`rsim_badges_${currentStoryId}`, JSON.stringify(updated));
                setTimeout(() => setNewBadgeNotification({ badge: data.endingBadge!, storyId: currentStoryId }), 100);
                return { ...prev, [currentStoryId]: updated };
             }
             return prev;
          });
        }

        // Auto-scroll to top of new content
        setTimeout(() => {
          if (mainRef.current) mainRef.current.scrollTo(0, 0);
          window.scrollTo(0, 0);
        }, 20);
        success = true;
      } catch (err: any) {
        attempt++;
        lastErrorMsg = err.message || "A rift in the simulation occurred.";
        
        if (lastErrorMsg.toLowerCase().includes("quota") || lastErrorMsg.includes("60 seconds") || lastErrorMsg.toLowerCase().includes("rate limit")) {
           break; // Stop retrying if rate limited
        }

        if (attempt < maxRetries) {
          const delay = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (!success) {
      setError(
        lastErrorMsg ||
          "Failed to reconstruct the scene after several attempts.",
      );
    }

    setLoading(false);
    setSelectedChoice(null);
  };

  useEffect(() => {
    if (
      appState === "playing" &&
      activeStoryId &&
      !loading &&
      history.length > 0
    ) {
      localStorage.setItem(
        `rsim_state_${activeStoryId}`,
        JSON.stringify(gameState),
      );
      localStorage.setItem(
        `rsim_history_${activeStoryId}`,
        JSON.stringify(history),
      );
      localStorage.setItem(
        `rsim_node_${activeStoryId}`,
        JSON.stringify(currentNode),
      );
    }
  }, [gameState, history, currentNode, appState, loading, activeStoryId]);

  const startGame = (storyId: string) => {
    initAudio();
    setAudioEnabled(true);
    setAppState("playing");
    setActiveStoryId(storyId);
    setHistory([]);
    setCurrentNode(null);
    setLoading(true);

    if (mainRef.current) mainRef.current.scrollTo(0, 0);
    window.scrollTo(0, 0);
    setTimeout(() => {
      if (mainRef.current) mainRef.current.scrollTo(0, 0);
      window.scrollTo(0, 0);
    }, 50);

    try {
      const savedState = localStorage.getItem(`rsim_state_${storyId}`);
      const savedHistory = localStorage.getItem(`rsim_history_${storyId}`);
      const savedNode = localStorage.getItem(`rsim_node_${storyId}`);

      if (savedState && savedHistory && savedNode) {
        setGameState(JSON.parse(savedState));
        setHistory(JSON.parse(savedHistory));
        setCurrentNode(JSON.parse(savedNode));
        setLoading(false);
        return;
      }
    } catch (e) {}

    // Fresh start
    const initState: GameState = {
      sanity: 100,
      lucidity: storyId === "the_bounty" ? 100 : 50,
      nostalgia: storyId === "the_bounty" ? 100 : 80,
      relationships: [],
      inventory: [],
      position: { x: 0, y: 0 },
      visited: [{ x: 0, y: 0 }],
    };
    setGameState(initState);
    fetchNextNode([], initState, storyId);
  };

  const handleChoice = (choice: Choice) => {
    if (!currentNode || loading || !activeStoryId) return;

    if (gameState.lucidity < 40 && Math.random() < 0.2) {
      setFlashWhite(true);
      setTimeout(() => setFlashWhite(false), 500);
      triggerAudioHallucination();
    }

    setSelectedChoice(choice.id);
    const newHistoryEntry: HistoryTurn = {
      narrative: currentNode.narrative,
      userChoice: choice.text,
    };
    const newHistory = [...history, newHistoryEntry];
    setHistory(newHistory);
    fetchNextNode(newHistory, gameState, activeStoryId);
  };

  const finishGame = () => {
    if (activeStoryId) {
      localStorage.setItem(`rsim_completed_${activeStoryId}`, "true");
      localStorage.removeItem(`rsim_state_${activeStoryId}`);
      localStorage.removeItem(`rsim_history_${activeStoryId}`);
      localStorage.removeItem(`rsim_node_${activeStoryId}`);
    }
    returnToMenu();
  };

  const returnToMenu = () => {
    setAppState("menu");
    setActiveStoryId(null);
    setCurrentNode(null);
    setHistory([]);
    window.speechSynthesis?.cancel();
  };

  const restartStory = () => {
    if (activeStoryId) {
      localStorage.removeItem(`rsim_state_${activeStoryId}`);
      localStorage.removeItem(`rsim_history_${activeStoryId}`);
      localStorage.removeItem(`rsim_node_${activeStoryId}`);

      setHistory([]);
      setCurrentNode(null);
      const initState: GameState = {
        sanity: 100,
        lucidity: activeStoryId === "the_bounty" ? 100 : 50,
        nostalgia: activeStoryId === "the_bounty" ? 100 : 80,
        relationships: [],
        inventory: [],
        position: { x: 0, y: 0 },
        visited: [{ x: 0, y: 0 }],
      };
      setGameState(initState);
      fetchNextNode([], initState, activeStoryId);
      window.speechSynthesis?.cancel();
    }
  };

  // Weather rendering
  const renderWeather = () => {
    if (!currentNode?.weatherEffect || currentNode.weatherEffect === "none")
      return null;
    const eff = currentNode.weatherEffect;
    if (eff === "rain") {
      return (
        <div className="absolute inset-0 pointer-events-none z-10 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/rain.png')] mix-blend-overlay animate-pulse" />
      );
    } else if (eff === "fog") {
      return (
        <div className="absolute inset-0 pointer-events-none z-10 opacity-40 bg-white/10 mix-blend-screen mix-blend-screen blur-[100px] animate-pulse" />
      );
    } else if (eff === "fire") {
      return (
        <div className="absolute inset-x-0 bottom-0 top-1/2 pointer-events-none z-10 bg-gradient-to-t from-orange-900/40 via-red-900/10 to-transparent mix-blend-color animate-pulse" />
      );
    } else if (eff === "static") {
      return (
        <div className="absolute inset-0 pointer-events-none z-10 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-screen" />
      );
    }
    return null;
  };

  const s = appState === "playing" ? Math.max(0, gameState.sanity) : 100;
  const jitterAmount = s < 30 ? 5 : s < 60 ? 2 : 0;
  const jitterDuration = s < 30 ? 0.1 : 0.3;

  const isCuteTheme = appState === "playing" && (activeStoryId === "frog_pond" || activeStoryId === "tardo");
  const isCyberFrog = appState === "playing" && activeStoryId === "please_be_patient";
  const isDesertSurvival = appState === "playing" && activeStoryId === "desert_survival";
  const isBounty = appState === "playing" && activeStoryId === "the_bounty";
  const isTardo = appState === "playing" && activeStoryId === "tardo";
  const maxFragments = activeStoryId === "desert_survival" || activeStoryId === "the_bounty" ? 50 : activeStoryId === "tardo" ? 15 : 25;

  const getScaleLabel = (type: "lucidity" | "nostalgia" | "sanity") => {
     if (activeStoryId === "tardo") {
        if (type === "lucidity") return "Motivation";
        if (type === "nostalgia") return "Excitement";
        if (type === "sanity") return "Cozy Energy";
     }
     if (activeStoryId === "frog_pond") {
        if (type === "lucidity") return "Wisdom";
        if (type === "nostalgia") return "Karma";
        if (type === "sanity") return "Happiness";
     }
     if (activeStoryId === "please_be_patient") {
        if (type === "lucidity") return "Stimulation";
        if (type === "nostalgia") return "Coziness";
        if (type === "sanity") return "Sweetness";
     }
     if (activeStoryId === "desert_survival") {
        if (type === "lucidity") return "Exhaustion";
        if (type === "nostalgia") return "Morale";
        if (type === "sanity") return "Hydration";
     }
     if (activeStoryId === "the_bounty") {
        const isFletcher = history.length > 0 && history[0].userChoice.toLowerCase().includes("fletcher");
        if (isFletcher) {
            if (type === "sanity") return "Crew Morale";
            if (type === "nostalgia") return "Discipline";
            if (type === "lucidity") return "Exhaustion";
        } else {
            if (type === "sanity") return "Authority";
            if (type === "nostalgia") return "Morale";
            if (type === "lucidity") return "Rations";
        }
     }
     return type === "lucidity" ? "Lucidity" : type === "nostalgia" ? "Nostalgia" : "Sanity";
  };

  return (
    <div
      className={`h-[100dvh] font-sans flex flex-col relative transition-colors duration-[3000ms] ${isBounty ? "bg-teal-950 text-emerald-100 selection:bg-teal-400/30 font-serif" : isDesertSurvival ? "bg-orange-950 text-orange-100 selection:bg-orange-400/30 font-serif" : isCuteTheme ? "bg-amber-50 text-emerald-950 selection:bg-emerald-200/50" : isCyberFrog ? "bg-slate-950 text-emerald-100 selection:bg-pink-500/30" : "bg-slate-950 text-slate-200 selection:bg-cyan-400/30"} overflow-hidden`}
    >
      {/* Background Atmosphere - FIXED to viewport */}
      <div className="fixed inset-0 z-0 opacity-60 pointer-events-none">
        <div
          className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] transition-colors duration-[3000ms] ${isDesertSurvival ? "bg-amber-700/60" : isCuteTheme ? "bg-emerald-300/40" : isCyberFrog ? "bg-emerald-900/60" : "bg-indigo-950/80"}`}
        ></div>
        <div
          className={`absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] rounded-full blur-[100px] transition-colors duration-[3000ms] ${isDesertSurvival ? "bg-red-900/60" : isCuteTheme ? "bg-amber-200/50" : isCyberFrog ? "bg-pink-900/40" : "bg-fuchsia-950/60"}`}
        ></div>
        <div
          className={`absolute top-[20%] left-[30%] w-[20%] h-[20%] rounded-full blur-[80px] transition-colors duration-[3000ms] ${isDesertSurvival ? "bg-orange-600/30" : isCuteTheme ? "bg-sky-200/40" : isCyberFrog ? "bg-cyan-900/30" : "bg-cyan-950/40"}`}
        ></div>
        {renderWeather()}
        <AnimatePresence>
          {newBadgeNotification && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="fixed inset-x-0 top-6 z-50 flex justify-center pointer-events-none drop-shadow-2xl"
            >
              <div className="bg-slate-900 border border-amber-500/50 rounded-full px-6 py-3 flex items-center gap-4 backdrop-blur-md">
                <span className="text-2xl animate-[bounce_1s_infinite]">🏆</span>
                <div>
                  <div className="text-[10px] text-amber-400/80 tracking-widest uppercase font-bold relative top-1">Badge Unlocked!</div>
                  <div className="text-white font-serif font-bold text-lg">{newBadgeNotification.badge}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating doodles */}
        <motion.div
          animate={{ y: [0, -10, 0], x: [0, 5, 0], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className={`absolute top-[10%] left-[15%] text-2xl opacity-20 ${isCuteTheme ? "hidden" : ""}`}
        >
          👻
        </motion.div>
        <motion.div
          animate={{ y: [0, 15, 0], rotate: [0, 180, 360] }}
          transition={{ repeat: Infinity, duration: 7, ease: "linear" }}
          className="absolute bottom-[20%] right-[10%] text-xl opacity-20 text-lime-300 drop-shadow-[0_0_5px_lime]"
        >
          ✩
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className={`absolute top-[50%] left-[5%] text-2xl ${isCuteTheme ? "text-emerald-700/30" : ""}`}
        >
          ✿
        </motion.div>
      </div>

      {/* Distorted Overlay Frame - FIXED */}
      <div
        className={`fixed inset-0 pointer-events-none border-[6px] sm:border-[16px] z-20 transition-colors duration-1000 ${isCuteTheme ? "border-amber-900/5 mix-blend-overlay" : "border-black/50 mix-blend-overlay"}`}
      ></div>

      {/* Critical Sanity CRT/Bleed Overlay */}
      {s < 30 && !isCuteTheme && (
        <div
          className="fixed inset-0 pointer-events-none z-50 mix-blend-color-burn animate-pulse"
          style={{
            background: `radial-gradient(circle, transparent ${s + 10}%, rgba(220, 38, 38, ${1 - s / 30}) 100%)`,
            boxShadow: `inset 0 0 ${150 - s}px rgba(220, 38, 38, ${0.8 - s / 60})`,
          }}
        />
      )}

      {/* Top Navigation / Status HUD */}
      {appState === "playing" && currentNode && (
        <nav
          className={`shrink-0 z-30 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-3 sm:py-4 ${isCuteTheme ? "bg-amber-100/80 border-amber-200/50" : "bg-slate-950/80 border-slate-800/50"} backdrop-blur-sm pointer-events-none transition-colors duration-[3000ms] border-b`}
        >
          <div className="flex justify-between w-full sm:w-auto items-center mb-4 sm:mb-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex flex-col">
                <span
                  className={`text-[9px] uppercase tracking-[0.3em] font-black flex items-center gap-2 ${isCuteTheme ? "text-emerald-500 drop-shadow-[0_0_8px_emerald]" : "text-cyan-400 drop-shadow-[0_0_8px_cyan]"}`}
                >
                  {activeStoryId === "frog_pond" ? "Frog Resonance" : activeStoryId === "tardo" ? "Cozy Vibes" : "Resonance"}
                  {loading && (
                    <Loader2
                      size={10}
                      className={`animate-spin ${isCuteTheme ? "text-amber-500 drop-shadow-[0_0_5px_amber]" : "text-lime-400 drop-shadow-[0_0_5px_lime]"}`}
                    />
                  )}
                </span>
                <span
                  className={`text-base sm:text-lg font-bold tracking-tight italic ${isCuteTheme ? "text-emerald-800" : "text-slate-300"}`}
                >
                  Fragment {history.length + 1}
                </span>
                <div
                  className={`w-full h-0.5 mt-1 rounded-full overflow-hidden ${isCuteTheme ? "bg-emerald-200" : "bg-slate-800"}`}
                >
                  <div
                    className={`h-full transition-all duration-1000 ${isCuteTheme || isTardo ? "bg-emerald-500" : "bg-cyan-400 shadow-[0_0_8px_cyan]"}`}
                    style={{
                      width: `${Math.min((history.length / maxFragments) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
                <div
                  className={`text-[8.5px] mt-1 uppercase font-bold tracking-widest ${isCuteTheme || isTardo ? "text-emerald-700/70" : "text-slate-500"}`}
                >
                  {Math.max(0, maxFragments - history.length)} fragments remain
                </div>
              </div>
              <div className="flex items-center gap-2 pointer-events-auto ml-1">
                <button
                  onClick={returnToMenu}
                  className={`px-3 py-1 border rounded text-[9px] uppercase tracking-[0.1em] transition-colors ${isCuteTheme ? "bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-800" : "bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 text-slate-300 hover:text-white"}`}
                >
                  Menu
                </button>
                <button
                  onClick={() => setShowJournal(!showJournal)}
                  className={`px-3 py-1 border rounded text-[9px] uppercase tracking-[0.1em] transition-colors ${isCuteTheme ? "bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-800" : "bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 text-slate-300 hover:text-white"}`}
                >
                  {showJournal ? "Close Journal" : "Journal"}
                </button>
                <button
                  onClick={restartStory}
                  className={`px-3 py-1 border rounded text-[9px] uppercase tracking-[0.1em] transition-colors ${isCuteTheme ? "bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-800" : "bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 text-slate-300 hover:text-white"}`}
                >
                  {isCuteTheme ? "Restart Tale" : "Wake Up"}
                </button>
              </div>
            </div>

            <button
              onClick={toggleAudio}
              className={`sm:hidden pointer-events-auto transition-colors flex items-center justify-center p-2 rounded-full ${isCuteTheme ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-200/50" : "text-slate-400 hover:text-cyan-400 hover:bg-cyan-900/20"}`}
              title="Toggle Ambient Audio"
            >
              {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>

          <div className="flex gap-3 sm:gap-6 pointer-events-auto items-center w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={toggleAudio}
              className={`hidden sm:flex transition-colors items-center justify-center p-2 rounded-full ${isCuteTheme ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-200/50" : "text-slate-400 hover:text-cyan-400 hover:bg-cyan-900/20"}`}
              title="Toggle Ambient Audio"
            >
              {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <div
              className={`flex flex-col items-end w-[28%] sm:w-20 border-r pr-2 sm:pr-4 ${isCuteTheme ? "border-amber-300" : "border-slate-800"}`}
            >
              <span
                className={`text-[7px] sm:text-[8px] uppercase tracking-[0.2em] font-bold ${isCuteTheme ? "text-sky-600" : isCyberFrog ? "text-pink-400 drop-shadow-[0_0_5px_pink]" : "text-fuchsia-400 drop-shadow-[0_0_5px_fuchsia]"}`}
              >
                {getScaleLabel('lucidity')}
              </span>
              <div
                className={`w-full h-1 mt-1 rounded-full overflow-hidden border ${isCuteTheme ? "bg-sky-100 border-sky-300" : "bg-slate-800 border-slate-700"}`}
              >
                <div
                  className={`h-full transition-all duration-1000 ${isCuteTheme ? "bg-sky-400" : isCyberFrog ? "bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]" : "bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.8)]"}`}
                  style={{
                    width: `${Math.max(0, Math.min(100, gameState.lucidity))}%`,
                  }}
                />
              </div>
            </div>
            <div
              className={`flex flex-col items-end w-[28%] sm:w-20 border-r pr-2 sm:pr-4 ${isCuteTheme ? "border-amber-300" : "border-slate-800"}`}
            >
              <span
                className={`text-[7px] sm:text-[8px] uppercase tracking-[0.2em] font-bold ${isCuteTheme ? "text-amber-600" : isCyberFrog ? "text-emerald-400 drop-shadow-[0_0_5px_emerald]" : "text-amber-400 drop-shadow-[0_0_5px_amber]"}`}
              >
                {getScaleLabel('nostalgia')}
              </span>
              <div
                className={`w-full h-1 mt-1 rounded-full overflow-hidden border ${isCuteTheme ? "bg-amber-100 border-amber-300" : "bg-slate-800 border-slate-700"}`}
              >
                <div
                  className={`h-full transition-all duration-1000 ${isCuteTheme ? "bg-amber-400" : isCyberFrog ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"}`}
                  style={{
                    width: `${Math.max(0, Math.min(100, gameState.nostalgia))}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col items-end w-[35%] sm:w-24">
              <span
                className={`text-[8px] sm:text-[10px] uppercase tracking-[0.2em] font-bold ${isCuteTheme ? "text-rose-500" : isCyberFrog ? "text-cyan-400 drop-shadow-[0_0_5px_cyan]" : "text-lime-400 drop-shadow-[0_0_5px_lime]"}`}
              >
                {getScaleLabel('sanity')} {gameState.sanity}%
              </span>
              <motion.div
                animate={s < 50 && !isCuteTheme && !isCyberFrog ? { y: [0, -1, 1, -1, 0] } : {}}
                transition={{
                  repeat: Infinity,
                  duration: jitterDuration,
                  ease: "linear",
                }}
                className={`w-full h-1 mt-1 rounded-full overflow-hidden border ${isCuteTheme ? "bg-rose-100 border-rose-300" : "bg-slate-800 border-slate-700"}`}
              >
                <div
                  className={`h-full transition-all duration-1000 ${isCuteTheme ? "bg-rose-400" : isCyberFrog ? "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" : "bg-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.8)]"}`}
                  style={{
                    width: `${Math.max(0, Math.min(100, gameState.sanity))}%`,
                  }}
                />
              </motion.div>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content Area - Scrollable */}
      <main
        ref={mainRef}
        className={`z-10 flex-1 flex flex-col px-4 sm:px-6 md:px-24 ${appState === "playing" ? "items-center py-8 sm:py-16" : appState === "splash" ? "items-center justify-center py-8 sm:py-12" : "items-center justify-start py-12"} overflow-y-auto custom-scrollbar min-h-0 w-full relative`}
      >
        {appState === "splash" && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="flex flex-col items-center justify-center max-w-2xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 min-h-full py-4 w-full"
          >
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-center font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white leading-tight px-2">
                THE STORY LIBRARY
              </h1>
              <p className="tracking-widest self-center text-center text-[8px] sm:text-[9px] uppercase mt-2 sm:mt-4 text-cyan-400 opacity-80 px-2">
                Choose Your Own Story Engine
              </p>
            </div>
            
            <div className="text-xs sm:text-sm text-center text-slate-300 leading-relaxed font-medium space-y-2 sm:space-y-3 px-4">
              <p>
                Welcome to The Story Library. This engine offers a collection of interactive, choice-driven tales, ranging from bite-sized stories to long, sprawling adventures. 
              </p>
              <p>
                Explore a multitude of themes, from cozy ponds and cowboy survival to atmospheric cosmic horrors. As you navigate through the fragments of each tale, your decisions will shape the narrative and directly influence your character's physiological and psychological states.
              </p>
              <p>
                Different metrics — from your sanity and exhaustion to morale and karma — will fluctuate, dynamically altering the audiovisual atmosphere, impacting the visual effects of text, and ultimately determining your final ending.
              </p>
              <p className="text-slate-500 italic mt-4 sm:mt-6 text-[10px] sm:text-xs">
                Audio is recommended for the full sensory experience.
              </p>
            </div>

            <button 
              onClick={() => setAppState("menu")}
              className="mt-4 sm:mt-6 px-8 py-3 border border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-100 hover:text-white transition-all uppercase tracking-[0.2em] text-[10px] sm:text-xs font-bold rounded shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
            >
              Enter The Library
            </button>
          </motion.div>
        )}

        {appState === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`w-full max-w-5xl px-4 pointer-events-auto`}
          >
            <div className="text-center mb-16">
              <h1
                className={`text-4xl sm:text-5xl md:text-6xl font-black mb-4 tracking-tight drop-shadow-sm text-white`}
              >
                THE LIBRARY
              </h1>
              <p
                className={`text-sm md:text-base max-w-xl mx-auto leading-relaxed text-slate-300 font-medium`}
              >
                Choose your adventure. Every book leads to a distinct universe,
                from scary horror to cozy and dreamy tales.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
              {stories.map((story) => {
                const isCompletedLocal = localStorage.getItem(
                  `rsim_completed_${story.id}`,
                );
                const isSunny = story.id === "frog_pond";
                const isCyberFrog = story.id === "please_be_patient";
                const getThemeStyles = () => {
                  if (story.id === "frog_pond") {
                    return {
                      card: "bg-pink-950/20 border-pink-500/20 hover:border-pink-400/80 hover:bg-emerald-900/30 hover:shadow-[0_10px_30px_rgba(236,72,153,0.2)]",
                      title: "text-pink-300",
                      icon: "text-pink-400",
                      button: "text-pink-400 group-hover:text-pink-300",
                      emoji: "🍄🐸✨",
                    };
                  } else if (story.id === "please_be_patient") {
                    return {
                      card: "bg-green-950/30 border-lime-500/30 hover:border-lime-400/80 hover:bg-green-900/40 hover:shadow-[0_10px_30px_rgba(132,204,22,0.2)]",
                      title: "text-lime-300",
                      icon: "text-lime-400",
                      button: "text-lime-400 group-hover:text-lime-300",
                      emoji: "🌆🍵🤖",
                    };
                  } else if (story.id === "echoes" || story.id === "static") {
                    return {
                      card: "bg-red-950/30 border-red-900/50 hover:border-red-500/60 hover:bg-red-900/40 hover:shadow-[0_10px_30px_rgba(220,38,38,0.2)]",
                      title: "text-red-400",
                      icon: "text-red-500",
                      button: "text-red-400 group-hover:text-red-300",
                      emoji: story.id === "static" ? "📻❄️🦌" : "👁️🩸🕸️",
                    };
                  } else if (story.id === "desert_survival") {
                    return {
                      card: "bg-orange-950/30 border-amber-600/30 hover:border-amber-500/60 hover:bg-orange-900/40 hover:shadow-[0_10px_30px_rgba(245,158,11,0.2)]",
                      title: "text-amber-400 font-serif",
                      icon: "text-amber-500",
                      button: "text-amber-500 group-hover:text-amber-400",
                      emoji: "🏜️🤠🐴",
                    };
                  } else if (story.id === "the_bounty") {
                    return {
                      card: "bg-teal-950/30 border-teal-600/30 hover:border-teal-500/60 hover:bg-teal-900/40 hover:shadow-[0_10px_30px_rgba(20,184,166,0.2)]",
                      title: "text-teal-400 font-serif",
                      icon: "text-teal-500",
                      button: "text-teal-500 group-hover:text-teal-400",
                      emoji: "⛵️🏝️⚔️",
                    };
                  } else if (story.id === "tardo") {
                    return {
                      card: "bg-sky-950/30 border-sky-400/30 hover:border-sky-300/80 hover:bg-sky-900/40 hover:shadow-[0_10px_30px_rgba(56,189,248,0.2)]",
                      title: "text-sky-300",
                      icon: "text-sky-400",
                      button: "text-sky-400 group-hover:text-sky-300",
                      emoji: "🚚🍔🛁",
                    };
                  } else {
                     return {
                      card: "bg-slate-900/60 border-purple-900/50 hover:border-red-500/60 hover:bg-slate-900 hover:shadow-[0_10px_30px_rgba(220,38,38,0.2)]",
                      title: "text-red-400",
                      icon: "text-purple-500",
                      button: "text-purple-400 group-hover:text-red-400",
                      emoji: "👁️🩸🕸️",
                    };
                  }
                };
                const styles = getThemeStyles();

                return (
                  <div
                    key={story.id}
                    className={`flex flex-col border p-6 md:p-8 rounded-xl shadow-lg transition-all hover:-translate-y-1 cursor-pointer group ${styles.card}`}
                    onClick={() => startGame(story.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <BookOpen
                        className={`${styles.icon} opacity-60 group-hover:opacity-100 transition-opacity`}
                        size={28}
                      />
                      {isCompletedLocal && (
                        <span className="text-[9px] uppercase font-bold tracking-widest text-lime-400 border border-lime-400/50 px-2 py-0.5 bg-lime-400/10 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <h2
                      className={`font-bold mb-1 font-serif ${story.title.length > 20 ? "text-lg sm:text-lg" : "text-xl sm:text-2xl"} ${styles.title}`}
                    >
                      {story.title}
                    </h2>
                    <div className="text-xs mb-3 flex justify-between items-center opacity-90">
                      <span>{styles.emoji}</span>
                      <span className="text-[10px] tracking-widest text-slate-500 uppercase font-medium">{story.id === "desert_survival" || story.id === "the_bounty" ? "50" : story.id === "tardo" ? "15" : "25"} Fragments</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 mb-6 flex-1 leading-relaxed overflow-y-auto max-h-[120px]">
                      {story.description}
                    </p>

                    {(unlockedBadges[story.id]?.length || 0) > 0 && (
                      <div className="mb-4">
                        <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Unlocked Badges</div>
                        <div className="flex flex-wrap gap-2">
                          {unlockedBadges[story.id].map((badge, idx) => (
                            <span key={idx} className={`text-[10px] px-2 py-1 bg-opacity-40 border rounded tracking-wider whitespace-nowrap ${
                              story.id === "frog_pond" ? "bg-pink-900 border-pink-800/50 text-pink-200" :
                              story.id === "please_be_patient" ? "bg-green-900 border-lime-800/50 text-lime-200" :
                              story.id === "the_bounty" ? "bg-teal-900 border-teal-800/50 text-teal-200" :
                              story.id === "tardo" ? "bg-sky-900 border-sky-800/50 text-sky-200" :
                              "bg-red-900 border-red-800/50 text-red-200"
                            }`}>
                              🏆 {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pointer-events-none border-t border-slate-700/50 pt-4 flex items-center justify-between">
                      <button
                        className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${styles.button}`}
                      >
                        {localStorage.getItem(`rsim_state_${story.id}`) ? "Resume Journey →" : "Open Book →"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {appState === "menu" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="w-full max-w-7xl mx-auto mt-16 px-4 mb-24"
          >
            <div className="flex flex-col items-center">
              <div className="w-full flex items-center mb-8 gap-4 opacity-50">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-500"></div>
                <h3 className="uppercase tracking-[0.3em] text-[11px] font-bold text-slate-200">Trophies & Endings Vault</h3>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-500"></div>
              </div>

              <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-6 md:p-10 w-full backdrop-blur-sm shadow-xl relative overflow-hidden">
                {/* Decorative visual shine */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none"></div>

                {Object.values(unlockedBadges).flat().length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 relative z-10">
                    {Object.entries(unlockedBadges).flatMap(([storyId, badges]) =>
                      badges.map((badge, idx) => {
                        const story = stories.find((s) => s.id === storyId);
                        
                        // Decide on a color scheme based on the story type
                        let themeAccent = "text-cyan-200 border-cyan-800/30 bg-cyan-950/20";
                        let trophyEmoji = "🏆";
                        
                        if (storyId === "frog_pond") {
                          themeAccent = "text-pink-200 border-pink-800/30 bg-pink-950/20";
                          trophyEmoji = "🍄";
                        } else if (storyId === "echoes") {
                          themeAccent = "text-red-300 border-red-800/30 bg-red-950/20";
                          trophyEmoji = "👁️";
                        } else if (storyId === "static") {
                          themeAccent = "text-red-300 border-red-800/30 bg-red-950/20";
                          trophyEmoji = "📻";
                        } else if (storyId === "please_be_patient") {
                          themeAccent = "text-lime-300 border-lime-800/30 bg-green-950/20";
                          trophyEmoji = "🍵";
                        } else if (storyId === "desert_survival") {
                          themeAccent = "text-amber-300 border-amber-800/30 bg-orange-950/20 font-serif";
                          trophyEmoji = "🌵";
                        } else if (storyId === "the_bounty") {
                          themeAccent = "text-teal-300 border-teal-800/30 bg-teal-950/20 font-serif";
                          trophyEmoji = "⛵️";
                        } else if (storyId === "tardo") {
                          themeAccent = "text-sky-300 border-sky-800/30 bg-sky-950/20";
                          trophyEmoji = "🍔";
                        }

                        return (
                          <div
                            key={`${storyId}-${idx}`}
                            className={`flex flex-col items-center justify-center p-4 border rounded-xl hover:brightness-125 transition duration-300 shadow-inner group ${themeAccent}`}
                          >
                            <div className="text-3xl mb-3 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform">
                              {trophyEmoji}
                            </div>
                            <div className={`text-[10px] sm:text-xs uppercase tracking-widest font-bold text-center leading-tight mb-2 drop-shadow-sm`}>
                              {badge}
                            </div>
                            <div className="text-[8px] sm:text-[9px] opacity-60 tracking-wider text-center uppercase">
                              {story?.title || storyId}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 flex flex-col items-center justify-center relative z-10">
                    <div className="text-4xl opacity-20 mb-4 font-serif">?</div>
                    <p className="text-slate-400 text-xs sm:text-sm tracking-[0.2em] uppercase mb-2 font-medium">
                      No Endings Discovered Yet
                    </p>
                    <p className="text-slate-600 text-[10px] sm:text-xs italic">
                      Read stories and reach a final conclusion to gather trophies here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {appState === "playing" && (
          <div className="w-full max-w-3xl flex flex-col items-center w-full pb-16 sm:pb-4">
            <AnimatePresence mode="wait">
              {loading && !currentNode ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-cyan-500/50 my-12"
                >
                  <div className="relative">
                    <div className="absolute -inset-4 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
                    <Loader2 className="w-8 h-8 animate-spin z-10 opacity-80" />
                  </div>
                  <p className="mt-8 uppercase tracking-[0.4em] text-[10px] opacity-70">
                    {loadingMessage}
                  </p>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center bg-red-950/30 backdrop-blur-md border border-red-500/30 p-8 rounded-xl my-12"
                >
                  <p className="text-red-400 font-light text-xl mb-4 italic tracking-wide">
                    {error}
                  </p>
                  <div className="flex gap-4 justify-center mt-6">
                    <button
                      onClick={() =>
                        fetchNextNode(history, gameState, activeStoryId!)
                      }
                      className="px-6 py-3 border border-red-500/50 hover:bg-red-500/20 text-red-100 transition-colors uppercase tracking-widest text-xs rounded"
                    >
                      Attempt Reconstruction
                    </button>
                    <button
                      onClick={returnToMenu}
                      className="px-6 py-3 border border-gray-700 hover:bg-gray-800 text-gray-400 transition-colors uppercase tracking-widest text-xs rounded"
                    >
                      Evacuate
                    </button>
                  </div>
                </motion.div>
              ) : currentNode && !showJournal ? (
                <div
                  key="story-container"
                  className={`w-full max-w-2xl bg-white text-slate-900 border-2 border-slate-300 p-4 md:p-6 sm:p-8 shadow-2xl flex flex-col relative shrink-0 min-h-[450px]`}
                >
                  {/* Decorative corner elements */}
                  <div className="absolute top-2 left-2 text-cyan-400 text-xs">
                    ✧
                  </div>
                  <div className="absolute bottom-2 right-2 text-lime-400 text-xs drop-shadow-[0_0_3px_lime]">
                    ♡
                  </div>

                  {/* Faint static overlay when sanity is low inside the pure white card */}
                  {s < 40 && (
                    <div className="absolute inset-0 pointer-events-none opacity-5 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-difference" />
                  )}

                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 z-10 shrink-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 ${loading ? "bg-cyan-400" : "bg-lime-400 shadow-[0_0_8px_lime]"} rounded-full animate-pulse`}
                      ></span>
                      <h2
                        className={`text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-extrabold text-slate-400`}
                      >
                        {currentNode.environment || "Anomalous Event"}
                      </h2>
                    </div>
                    {/* Read Aloud Button */}
                    <button
                      onClick={readAloud}
                      className={`transition-colors flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold text-slate-400 hover:text-cyan-500`}
                    >
                      <Radio
                        size={12}
                        className={
                          isSpeaking ? "animate-pulse text-cyan-400" : ""
                        }
                      />{" "}
                      {isSpeaking ? "Silence" : "Listen..."}
                    </button>
                  </div>

                  {/* Wrapper for content */}
                  <div className="relative flex-1 flex flex-col min-h-0">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentNode.narrative}
                        initial={{ opacity: 0, filter: "blur(2px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, filter: "blur(2px)" }}
                        transition={{ duration: 0.3 }}
                        className={`flex flex-col flex-1 min-h-0 py-1 ${loading ? "opacity-40 pointer-events-none grayscale" : ""}`}
                      >
                        {/* Narrative Text */}
                        <div
                          className={`text-[13px] sm:text-[15px] md:text-[17px] leading-relaxed prose prose-invert w-full max-w-none text-slate-800 font-medium ${s < 30 ? "font-serif tracking-tighter" : ""}`}
                        >
                          <p>
                            {currentNode.narrative.split(" ").map((word, i) => {
                              let isGlitching = false;
                              if (isCuteTheme) {
                                const lowWisdomKarma =
                                  gameState.nostalgia <= 25 ||
                                  gameState.sanity <= 25 ||
                                  gameState.lucidity <= 25;
                                if (lowWisdomKarma) {
                                  const intensity = Math.max(
                                    0,
                                    50 -
                                      Math.min(
                                        gameState.nostalgia,
                                        gameState.sanity,
                                      ),
                                  );
                                  isGlitching = (i * 13) % 100 < intensity;
                                }
                              } else if (isCyberFrog) {
                                const intensity = gameState.lucidity > 50 ? gameState.lucidity - 50 : 0;
                                isGlitching = intensity > 20 && (i * 13) % 100 < intensity / 2;
                              } else if (isDesertSurvival) {
                                const intensity = 100 - gameState.sanity;
                                isGlitching = intensity > 20 && (i * 13) % 100 < intensity / 3;
                              } else if (isBounty) {
                                isGlitching = false;
                              } else {
                                const intensity = 100 - gameState.lucidity;
                                isGlitching =
                                  intensity > 20 &&
                                  (i * 13) % 100 < intensity / 3;
                              }

                              if (isGlitching) {
                                const type = (i * 7) % 3;
                                if (type === 0)
                                  return (
                                    <span
                                      key={i}
                                      className="bg-slate-200 text-transparent animate-pulse rounded-sm opacity-50 px-1"
                                    >
                                      {word}{" "}
                                    </span>
                                  );
                                if (type === 1)
                                  return (
                                    <span
                                      key={i}
                                      className="line-through decoration-slate-400 opacity-60 inline-block -rotate-2"
                                    >
                                      {word}{" "}
                                    </span>
                                  );
                                if (type === 2)
                                  return (
                                    <span
                                      key={i}
                                      className="blur-[2px] opacity-40"
                                    >
                                      {word}{" "}
                                    </span>
                                  );
                              }
                              return <span key={i} className={s < 30 && (i % 5 === 0) ? "glitch-text inline-block" : undefined}>{word} </span>;
                            })}
                          </p>
                        </div>

                        <div
                          className={`h-[1px] w-full bg-slate-200 my-3 sm:my-4 shrink-0`}
                        ></div>

                        {/* Choices Grid */}
                        <div className="flex-1 flex flex-col justify-end min-h-min mt-4">
                          {currentNode.choices &&
                          currentNode.choices.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                              {currentNode.choices.map((choice, i) => {
                                const isSelected = selectedChoice === choice.id;
                                const isDimmed =
                                  loading &&
                                  !isSelected &&
                                  selectedChoice !== null;

                                const gaslightStrings = activeStoryId === "tardo"
                                  ? [
                                      "Yum, burger time",
                                      "The pup is waiting!",
                                      "Pidzer...",
                                      "Slow life is good",
                                      "Mow the lawn",
                                    ]
                                  : isCuteTheme
                                  ? [
                                      "Just take a nap",
                                      "Look at that bug!",
                                      "Ribbit?",
                                      "Eat a fly",
                                      "It's a nice day",
                                    ]
                                  : isCyberFrog
                                  ? [
                                      "Too loud...",
                                      "Need quiet...",
                                      "So fast...",
                                      "Overwhelming...",
                                      "Hide in the fern",
                                    ]
                                  : isDesertSurvival
                                  ? [
                                      "Drink the sand",
                                      "Walk towards the shimmering lake",
                                      "Lie down in the sun",
                                      "Listen to the vultures",
                                      "Let the desert take you",
                                      "Rest your weary bones forever",
                                    ]
                                  : isBounty
                                  ? [
                                      "Throw him overboard...",
                                      "The breadfruit is rotting...",
                                      "They are whispering about you...",
                                      "Turn the ship around...",
                                      "Let the sea take it all...",
                                      "Blood on the deck...",
                                      "Mutiny...",
                                      "They're plotting below deck...",
                                      "We'll never make it home...",
                                      "The captain's gone mad...",
                                      "I can see the island..."
                                    ]
                                  : [
                                      "Step into the incinerator",
                                      "Tear off your skin",
                                      "Stop breathing now",
                                      "Swallow the key",
                                      "Let the shadow win",
                                      "Jump into traffic",
                                    ];
                                const hash = choice.text
                                  .split("")
                                  .reduce(
                                    (acc, char) => acc + char.charCodeAt(0),
                                    0,
                                  );
                                const gaslightText =
                                  gaslightStrings[
                                    hash % gaslightStrings.length
                                  ];
                                const isGaslighting =
                                  hoverGaslightId === choice.id &&
                                  (isCuteTheme
                                    ? gameState.lucidity <= 25 ||
                                      gameState.nostalgia <= 25
                                    : isCyberFrog
                                    ? gameState.lucidity > 75 ||
                                      gameState.sanity < 25
                                    : isDesertSurvival
                                    ? gameState.sanity < 60
                                    : isBounty
                                    ? gameState.sanity < 50 || gameState.lucidity < 50 || gameState.nostalgia < 40
                                    : gameState.sanity < 50 ||
                                      gameState.lucidity < 40);

                                return (
                                  <button
                                    key={choice.id}
                                    onClick={() => handleChoice(choice)}
                                    onMouseEnter={() =>
                                      setHoverGaslightId(choice.id)
                                    }
                                    onMouseLeave={() =>
                                      setHoverGaslightId(null)
                                    }
                                    disabled={loading}
                                    className={`group flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 rounded-none text-left transition-all duration-300 ease-out border-2 ${
                                      isSelected
                                        ? "bg-cyan-50 border-cyan-400 cursor-wait shadow-[0_0_15px_cyan]"
                                        : isDimmed
                                          ? "opacity-30 border-slate-200 grayscale cursor-not-allowed"
                                          : "bg-white border-slate-200 hover:border-lime-400 hover:bg-slate-50 hover:shadow-[0_0_15px_lime]"
                                    }`}
                                  >
                                    <div className="flex items-center gap-4 w-full">
                                      <span
                                        className={`text-[10px] sm:text-[11px] transition-colors uppercase tracking-widest font-black shrink-0 ${isSelected ? "text-cyan-500" : "text-slate-300 group-hover:text-lime-500"}`}
                                      >
                                        0{i + 1}
                                      </span>
                                      <span
                                        className={`flex-1 text-[11px] sm:text-[13px] leading-tight font-bold transition-all group-hover:translate-x-1 ${isSelected ? "text-cyan-700" : isGaslighting ? (isCuteTheme ? "text-emerald-500 bg-emerald-50 skew-x-[2deg] rotate-1" : isCyberFrog ? "text-pink-500 bg-pink-100/50 skew-x-[-5deg] -rotate-1" : isDesertSurvival ? "text-orange-500 bg-orange-100/50 skew-x-[5deg] blur-[0.5px]" : "text-red-600 bg-red-100 skew-x-[-10deg]") : "text-slate-600 group-hover:text-slate-900"}`}
                                      >
                                        {isGaslighting ? (
                                          <span className="animate-pulse">
                                            {gaslightText}
                                          </span>
                                        ) : (
                                          <span>{choice.text}</span>
                                        )}
                                      </span>
                                    </div>
                                    {isSelected && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-widest text-cyan-500 font-black animate-pulse whitespace-nowrap">
                                          Syncing...
                                        </span>
                                        <Loader2
                                          size={14}
                                          className="text-cyan-400 rotate-180 animate-spin"
                                        />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center mt-8 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                              {currentNode.isEnding && currentNode.endingBadge && (
                                <div className="text-center bg-cyan-950/40 border border-cyan-800 p-6 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                                  <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 mb-2 font-bold">New Badge Unlocked</div>
                                  <div className="text-xl font-serif text-cyan-100 tracking-wide">🏆 {currentNode.endingBadge}</div>
                                </div>
                              )}
                              <button
                                onClick={finishGame}
                                className={`px-8 py-3 border transition-all uppercase tracking-[0.2em] text-xs font-black rounded-sm border-cyan-400 hover:bg-cyan-400 hover:text-slate-900 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]`}
                              >
                                Accept The End
                              </button>
                            </div>
                          )}
                        </div>

                        {history.length > 0 && gameState.sanity > 0 && (
                          <div className="mt-8 text-center opacity-40 hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={restartStory}
                              className="text-[8px] text-slate-400 hover:text-cyan-500 uppercase tracking-[0.3em] transition-colors font-bold"
                            >
                              [ Wake Up ]
                            </button>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              ) : null}
              {showJournal && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-2xl bg-slate-900/90 backdrop-blur-md text-slate-200 border-2 border-slate-700 p-4 md:p-6 sm:p-8 shadow-2xl flex flex-col relative shrink-0 min-h-[450px]"
                >
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-cyan-400 mb-6 border-b border-slate-700 pb-2">
                    Journal Entries
                  </h2>
                  <div className="flex flex-col gap-6">
                    {history.length === 0 ? (
                      <p className="text-slate-500 italic text-sm">
                        The pages are blank. Let the dream unfold first.
                      </p>
                    ) : (
                      history.map((turn, idx) => (
                        <div key={idx} className="flex flex-col gap-2">
                          <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                            {turn.narrative}
                          </p>
                          <div className="flex items-center gap-2 pl-4 border-l-2 border-cyan-800">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                              Choice
                            </span>
                            <span className="text-xs font-semibold text-cyan-400">
                              {turn.userChoice}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inventory / Tracking - Attached directly under the story box */}
            {appState === "playing" && (currentNode || showJournal) && (
              <div className="w-full max-w-2xl mt-4 flex items-end justify-between transition-colors duration-[3000ms]">
                <div className="flex flex-wrap gap-4 sm:gap-6 items-end pointer-events-auto">
                  {gameState.relationships &&
                    gameState.relationships.length > 0 && (
                      <div
                        className={`flex flex-col p-3 rounded-none border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-lg`}
                      >
                        <span
                          className={`text-[8px] sm:text-[9px] uppercase font-bold tracking-wider mb-1 text-slate-500`}
                        >
                          Friends
                        </span>
                        {gameState.relationships.map((r, i) => (
                          <span
                            key={i}
                            className={`text-[10px] text-slate-300 font-bold`}
                          >
                            {r.entity}{" "}
                            <span className={`text-cyan-400`}>
                              [{r.status}]
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  {gameState.mementos && gameState.mementos.length > 0 && (
                    <div
                      className={`flex flex-col p-3 rounded-none border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-lg`}
                    >
                      <span
                        className={`text-[8px] sm:text-[9px] uppercase font-bold tracking-wider mb-1 text-slate-500`}
                      >
                        Mementos
                      </span>
                      {gameState.mementos.map((m, i) => (
                        <span
                          key={i}
                          className={`text-[10px] text-slate-300 font-bold group relative cursor-help`}
                        >
                          {m.name}
                          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block w-max max-w-[150px] p-2 bg-slate-800 text-cyan-300 text-[9px] font-mono border border-slate-600 rounded">
                            {m.condition}
                          </div>
                        </span>
                      ))}
                    </div>
                  )}
                  {gameState.inventory && gameState.inventory.length > 0 && (
                    <div
                      className={`flex flex-col p-3 rounded-none border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-lg`}
                    >
                      <span
                        className={`text-[8px] sm:text-[9px] uppercase font-bold tracking-wider mb-1 text-slate-500`}
                      >
                        Inventory
                      </span>
                      {gameState.inventory.map((item, i) => (
                        <span
                          key={i}
                          className={`text-[10px] text-fuchsia-300 font-bold drop-shadow-[0_0_2px_fuchsia]`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={`flex items-center gap-4 text-[8px] sm:text-[10px] font-black tracking-widest drop-shadow-md text-slate-500`}
                >
                  <span className="flex items-center gap-2 font-bold uppercase">
                    <div
                      className={`w-1.5 h-1.5 animate-[pulse_2s_ease-in-out_infinite] rounded-full ${isCuteTheme ? "bg-rose-400 shadow-[0_0_5px_rose]" : isCyberFrog ? "bg-emerald-400 shadow-[0_0_5px_emerald]" : "bg-lime-400 shadow-[0_0_5px_lime]"}`}
                    ></div>{" "}
                    {activeStoryId === "tardo" ? "VAN" : activeStoryId === "frog_pond" ? "POND" : isCyberFrog ? "NATURE CORELINK" : "SYSTEM"} {gameState.sanity <= 0 ? "CRITICAL" : (isCuteTheme ? "SUNNY" : "ACTIVE")}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {flashWhite && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="fixed inset-0 bg-white z-[100] pointer-events-none mix-blend-screen"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
