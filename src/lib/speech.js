/*
 * ORATOR speech engine.
 * - Captures the microphone (MediaRecorder) so the user can review their attempt.
 * - Transcribes live via the Web Speech API where the browser supports it.
 * - Gathers REAL measurements only: timing, energy samples (loudness variation,
 *   silence gaps). No invented metrics. If a capability is unavailable, the
 *   attempt is flagged accordingly and the analysis stays honest.
 */

export function speechCapabilities() {
  if (typeof window === 'undefined') return { mic: false, recognition: false };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return {
    mic: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
    recognition: !!SR,
  };
}

/*
 * Start a capture session.
 * opts: { onTranscript(text, isFinal), onInterim(text), onNoSpeech() }
 * Returns a handle: { stop(): Promise<attemptAudio>, cancel(), state }
 */
export async function startCapture(opts = {}) {
  const caps = speechCapabilities();
  if (!caps.mic) throw new Error('NOMIC');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.start();

  // Real audio measurements: RMS energy sampled every 100ms.
  const energies = [];
  const startedAt = performance.now();
  const energyTimer = window.setInterval(() => {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
    energies.push({ t: Math.round(performance.now() - startedAt), rms: Math.sqrt(sum / buf.length) });
  }, 100);

  // Live transcription where supported.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  const finalSegments = [];
  let recognitionWorking = false;
  const segmentTimes = [];

  // Mobile Chrome (and others) silently end SpeechRecognition after a few
  // seconds of ambiguous audio, even with continuous=true — the mic UI can
  // keep showing "recording" while transcription has actually stopped. We
  // detect that and restart it transparently until stop()/cancel() is called.
  let captureEnded = false;
  let fatalMicError = false;

  function attachRecognition() {
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (event) => {
      recognitionWorking = true;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const seg = { text: res[0].transcript, isFinal: res.isFinal, t: Math.round(performance.now() - startedAt) };
        if (res.isFinal) {
          finalSegments.push(seg);
          segmentTimes.push(seg.t);
          if (opts.onTranscript) opts.onTranscript(finalSegments.map((s) => s.text).join(' '), true);
        } else {
          interim += res[0].transcript;
        }
      }
      if (opts.onInterim && interim) opts.onInterim(interim);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') fatalMicError = true;
      // 'no-speech' and network errors: leave transcript empty; onend below restarts it.
    };
    r.onend = () => {
      if (captureEnded || fatalMicError) return;
      // Recognition stopped on its own mid-attempt — restart immediately so the
      // rest of the answer still gets transcribed instead of going silent.
      try { recognition = attachRecognition(); recognition.start(); } catch { /* give up quietly */ }
    };
    return r;
  }

  if (SR) {
    try { recognition = attachRecognition(); recognition.start(); } catch { recognition = null; }
  }

  async function stop() {
    captureEnded = true;
    window.clearInterval(energyTimer);
    try { if (recognition) recognition.stop(); } catch { /* already stopped */ }
    recorder.state !== 'inactive' && recorder.stop();
    const blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' }));
      if (recorder.state === 'inactive') resolve(new Blob(chunks, { type: 'audio/webm' }));
    });
    stream.getTracks().forEach((t) => t.stop());
    audioContext.close().catch(() => {});
    const durationMs = Math.round(performance.now() - startedAt);
    const transcript = finalSegments.map((s) => s.text).join(' ').trim();
    return {
      audioBlob: blob.size ? blob : null,
      durationMs,
      energies,
      segmentTimes,
      transcript,
      transcriptSource: recognitionWorking && transcript ? 'speech-api' : 'unavailable',
    };
  }

  function cancel() {
    captureEnded = true;
    window.clearInterval(energyTimer);
    try { if (recognition) recognition.abort(); } catch { /* noop */ }
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* noop */ }
    stream.getTracks().forEach((t) => t.stop());
    audioContext.close().catch(() => {});
  }

  return { stop, cancel, isTranscribing: () => !!recognition };
}

/* Derive honest vocal indicators from the energy envelope. */
export function audioDeliveryMetrics(energies, durationMs) {
  if (!energies || energies.length < 8) return { measured: false };
  const vals = energies.map((e) => e.rms);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean < 0.004) return { measured: true, spokeEnough: false };
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const cv = Math.sqrt(variance) / mean; // variation in loudness
  // silence gaps: consecutive samples below 15% of mean for >= 0.8s
  const threshold = mean * 0.15;
  let pauses = 0;
  let run = 0;
  vals.forEach((v) => {
    if (v < threshold) run += 1; else { if (run >= 8) pauses += 1; run = 0; }
  });
  if (run >= 8) pauses += 1;
  return { measured: true, spokeEnough: true, loudnessVariation: cv, pauseCount: pauses, durationMs };
}
