// Simple Web Audio API Synthesizer to generate ambient backing tones

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentOscillators: OscillatorNode[] = [];

let activeTone: string | null = null;
let activeSanity: number | null = null;
let activeStoryId: string | null = null;

export function initAudio() {
  if (typeof window !== "undefined" && !audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
  }
}

export function setToneConfig(tone: "calm" | "tense" | "chaotic" | "mystical", sanity: number, storyId?: string) {
  if (!audioCtx) return;

  // Prevent restarting the same tone if parameters haven't significantly changed
  const isSameStory = storyId === activeStoryId;
  const isSameTone = tone === activeTone;
  
  if (isSameStory && isSameTone && currentOscillators.length > 0) {
     activeSanity = sanity; // Update active sanity but don't restart audio to maintain immersion
     return; // Keep current audio playing continuously
  }

  activeTone = tone;
  activeSanity = sanity;
  activeStoryId = storyId || null;

  const now = audioCtx.currentTime;

  // Stash old audio data and gently fade out over 3 seconds
  if (masterGain && currentOscillators.length > 0) {
    const oldMaster = masterGain;
    const oldOscs = currentOscillators;
    
    oldMaster.gain.cancelScheduledValues(now);
    oldMaster.gain.setValueAtTime(oldMaster.gain.value, now);
    oldMaster.gain.linearRampToValueAtTime(0, now + 3.0);
    
    setTimeout(() => {
      oldOscs.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      oldMaster.disconnect();
    }, 3500);
  }

  // Create new active gain context immediately for seamless crossfade
  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.connect(audioCtx.destination);
  currentOscillators = [];

  const playNow = now;

  const isSunny = storyId === "frog_pond" || storyId === "tardo";
  const isCyberFrog = storyId === "please_be_patient";
  const isBounty = storyId === "the_bounty";

  if (isBounty) {
    // Endless building human beat, less synth chimes, more organic swell
    const baseFreq = tone === "chaotic" || tone === "tense" ? 55.0 : 73.42; // A1 or D2
    
    // Low pounding pulse (building beat)
    createOscillator(baseFreq, "sine", playNow, sanity, "bounty_pulse"); 
    
    // Organic layered hums (human drone)
    createOscillator(baseFreq * 1.5, "triangle", playNow, sanity, "bounty_drone"); // 5th 
    createOscillator(baseFreq * 2.0, "sine", playNow, sanity, "bounty_drone"); // Octave
    createOscillator(baseFreq * 3.0, "sine", playNow, sanity, "bounty_drone"); // Octave + 5th (soft)
  } else if (isSunny) {
    const baseFreq = 220 + (sanity / 2); 
    createOscillator(baseFreq, "sine", playNow, sanity, "sunny");
    createOscillator(baseFreq * 1.25, "triangle", playNow, sanity, "sunny");
    createOscillator(baseFreq * 1.5, "sine", playNow, sanity, "sunny");
    createOscillator(baseFreq * 2, "sine", playNow, sanity, "sunny");
  } else if (isCyberFrog) {
    const baseFreq = tone === "chaotic" || tone === "tense" ? 80 : 150 + (sanity / 3);
    createOscillator(baseFreq, tone === "chaotic" ? "sawtooth" : "triangle", playNow, sanity, "sunny");
    createOscillator(baseFreq * 1.5, "sine", playNow, sanity, "sunny");
    if (tone === "calm" || tone === "mystical") {
      createOscillator(baseFreq * 2, "sine", playNow, sanity, "sunny");
    } else {
      createOscillator(baseFreq * 1.1, "square", playNow, sanity, "sunny");
    }
  } else if (tone === "calm") {
    const baseFreq = 110; 
    createOscillator(baseFreq, "sine", playNow, sanity, "default");
    createOscillator(baseFreq * 1.5, "sine", playNow, sanity, "default");
  } else if (tone === "mystical") {
    const baseFreq = 164.81; // E3
    createOscillator(baseFreq, "triangle", playNow, sanity);
    createOscillator(baseFreq * 1.2, "sine", playNow, sanity); // minor third
    createOscillator(baseFreq * 1.5, "triangle", playNow, sanity); // perfect fifth
  } else if (tone === "chaotic") {
    const baseFreq = 50 + (sanity / 2);
    createOscillator(baseFreq, "square", playNow, sanity);
    createOscillator(baseFreq * 1.1, "sawtooth", playNow, sanity);
    createOscillator(baseFreq * 1.8, "square", playNow, sanity);
    createOscillator(baseFreq * 2.3, "sawtooth", playNow, sanity);
  } else {
    // tense or default unsettling drone
    const baseFreq = 30 + (sanity / 4); 
    // Dissonant intervals (minor 2nd, tritone)
    createOscillator(baseFreq, "sawtooth", playNow, sanity);
    createOscillator(baseFreq * 1.059, "sawtooth", playNow, sanity); // minor 2nd clash
    createOscillator(baseFreq * 1.414, "square", playNow, sanity); // tritone
  }

  // Crossfade in new master
  masterGain.gain.linearRampToValueAtTime(0.05, playNow + 3.0);
}

function createOscillator(freq: number, type: OscillatorType, time: number, sanity: number, mode: "default" | "sunny" | "bounty_pulse" | "bounty_drone" = "default") {
  if (!audioCtx || !masterGain) return;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  
  // Add a little LFO to frequency for ambient movement
  const lfo = audioCtx.createOscillator();
  if (mode === "sunny") {
     lfo.frequency.value = 0.2; // soft gentle swaying
     const lfoGain = audioCtx.createGain();
     lfoGain.gain.value = 2; // subtle vibrato
     lfo.connect(lfoGain);
     lfoGain.connect(osc.frequency);
  } else if (mode === "bounty_pulse") {
     lfo.frequency.value = 0.1; 
     const lfoGain = audioCtx.createGain();
     lfoGain.gain.value = 1;
     lfo.connect(lfoGain);
     lfoGain.connect(osc.frequency);
     
     const pulseGain = audioCtx.createGain();
     pulseGain.gain.setValueAtTime(0, time);
     pulseGain.gain.linearRampToValueAtTime(1, time + 2); // swell over 2 secs

     // Create an amplitude LFO for the heartbeat/building beat
     const beatLfo = audioCtx.createOscillator();
     const beatRate = (+sanity < 25) ? 2.5 : (+sanity < 50 ? 1.8 : 1.1); // Speeds up as sanity drops
     beatLfo.frequency.value = beatRate;
     beatLfo.type = "sine";
     
     const beatLfoScale = audioCtx.createGain();
     beatLfoScale.gain.value = 1.0; 
     beatLfo.connect(beatLfoScale);
     
     // Modulate the pulse gain
     beatLfoScale.connect(pulseGain.gain);
     
     beatLfo.start(time);
     currentOscillators.push(beatLfo);

     osc.connect(pulseGain);
     pulseGain.connect(masterGain);
  } else if (mode === "bounty_drone") {
     lfo.frequency.value = 0.08; // very slow evolving vocal-like drift
     const lfoGain = audioCtx.createGain();
     lfoGain.gain.value = 4; // wide drift
     lfo.connect(lfoGain);
     lfoGain.connect(osc.frequency);
     
     // Slow attack & subtle volume swelling for the drone
     const envGain = audioCtx.createGain();
     envGain.gain.setValueAtTime(0, time);
     envGain.gain.linearRampToValueAtTime(0.6, time + 6); // slow crescendo
     
     const volumeLfo = audioCtx.createOscillator();
     volumeLfo.frequency.value = 0.03; // extremly slow volume breath
     volumeLfo.type = "triangle";
     const volumeLfoScale = audioCtx.createGain();
     volumeLfoScale.gain.value = 0.2;
     volumeLfo.connect(volumeLfoScale);
     volumeLfoScale.connect(envGain.gain);
     volumeLfo.start(time);
     currentOscillators.push(volumeLfo);

     osc.connect(envGain);
     envGain.connect(masterGain);
  } else {
     // Faster, more intense LFO when sanity is low (heartbeat/panic effect)
     lfo.frequency.value = sanity < 30 ? 4.0 : (sanity < 60 ? 1.5 : 0.1);
     const lfoGain = audioCtx.createGain();
     lfoGain.gain.value = sanity < 30 ? 15 : (sanity < 60 ? 5 : 2);
     lfo.connect(lfoGain);
     lfoGain.connect(osc.frequency);
  }
  lfo.start(time);

  if (mode !== "bounty_pulse" && mode !== "bounty_drone") {
     osc.connect(masterGain);
  }
  osc.start(time);
  currentOscillators.push(osc);
  currentOscillators.push(lfo); // store to stop later
}

export function stopAudio() {
  if (audioCtx && masterGain) {
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
  }
}

export function triggerAudioHallucination() {
  if (!audioCtx || !masterGain) return;
  const playNow = audioCtx.currentTime;
  
  const osc = audioCtx.createOscillator();
  const isHeartbeat = Math.random() < 0.5;
  
  if (isHeartbeat) {
     osc.type = "sawtooth";
     osc.frequency.value = 40;
     const oscGain = audioCtx.createGain();
     oscGain.gain.setValueAtTime(0, playNow);
     oscGain.gain.linearRampToValueAtTime(0.3, playNow + 0.1);
     oscGain.gain.exponentialRampToValueAtTime(0.01, playNow + 0.4);
     
     osc.connect(oscGain);
     oscGain.connect(masterGain);
     osc.start(playNow);
     osc.stop(playNow + 0.5);
  } else {
     osc.type = "triangle";
     osc.frequency.setValueAtTime(Math.random() * 800 + 200, playNow);
     osc.frequency.exponentialRampToValueAtTime(50, playNow + 1.5);
     
     const oscGain = audioCtx.createGain();
     oscGain.gain.setValueAtTime(0, playNow);
     oscGain.gain.linearRampToValueAtTime(0.15, playNow + 0.05);
     oscGain.gain.exponentialRampToValueAtTime(0.01, playNow + 1.5);
     
     osc.connect(oscGain);
     oscGain.connect(masterGain);
     osc.start(playNow);
     osc.stop(playNow + 1.6);
  }
}
