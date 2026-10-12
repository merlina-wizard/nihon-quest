import { useEffect, useState } from "react";

/** Tiene lo schermo acceso finché il componente è visibile (testo per il tassista, biglietti con QR). */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const req = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (alive) lock = l; else l.release();
      } catch { /* batteria scarica o permesso negato: pazienza */ }
    };
    // Il blocco cade quando l'app va in background: lo si richiede al ritorno.
    const onVis = () => { if (document.visibilityState === "visible") req(); };
    req();
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; lock?.release(); document.removeEventListener("visibilitychange", onVis); };
  }, []);
}

/** Voce giapponese del telefono, se c'è (le voci arrivano anche dopo, con "voiceschanged"). */
export function useJaVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pick = () => setVoice(speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().replace("_", "-").startsWith("ja")) || null);
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick);
    return () => { speechSynthesis.removeEventListener("voiceschanged", pick); speechSynthesis.cancel(); };
  }, []);
  return voice;
}

export function speakJa(text: string, voice: SpeechSynthesisVoice) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[…/]/g, "、"));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.85;
  speechSynthesis.speak(u);
}
