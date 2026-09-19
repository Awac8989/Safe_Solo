// SafeSolo Web Audio API Siren Synthesizer
// Generates emergency alarms natively without external audio files

class AudioAlarmSynthesizer {
  private audioCtx: AudioContext | null = null;
  private currentOscillator: OscillatorNode | null = null;
  private currentGain: GainNode | null = null;
  private sweepInterval: any = null;
  private isMuted: boolean = false;
  private isAlarmPlaying: boolean = false;

  private initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public getMuted() {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public toggleMuted() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public playP1Siren() {
    if (this.isMuted || this.isAlarmPlaying) return;
    const ctx = this.initContext();
    if (!ctx) return;

    this.stop();
    this.isAlarmPlaying = true;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.currentOscillator = osc;
      this.currentGain = gain;

      // Pitch sweep simulation (650Hz to 950Hz up and down)
      let goingUp = true;
      let freq = 650;
      this.sweepInterval = setInterval(() => {
        if (!this.audioCtx || !this.currentOscillator) return;
        if (goingUp) {
          freq += 35;
          if (freq >= 950) goingUp = false;
        } else {
          freq -= 35;
          if (freq <= 650) goingUp = true;
        }
        try {
          this.currentOscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        } catch {}
      }, 50);
    } catch (err) {
      console.warn('Audio siren error:', err);
    }
  }

  public playP2Beep() {
    if (this.isMuted || this.isAlarmPlaying) return;
    const ctx = this.initContext();
    if (!ctx) return;

    this.stop();
    this.isAlarmPlaying = true;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.currentOscillator = osc;
      this.currentGain = gain;

      // Pulsing on/off beep
      let isOn = true;
      this.sweepInterval = setInterval(() => {
        if (!this.audioCtx || !this.currentGain) return;
        isOn = !isOn;
        try {
          this.currentGain.gain.setValueAtTime(isOn ? 0.15 : 0.001, this.audioCtx.currentTime);
        } catch {}
      }, 350);
    } catch (err) {
      console.warn('Audio beep error:', err);
    }
  }

  public playTestSpeaker() {
    const ctx = this.initContext();
    if (!ctx) return;

    this.stop();
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      // Chirp
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.6);

      setTimeout(() => {
        try {
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
          setTimeout(() => {
            osc.stop();
            osc.disconnect();
          }, 250);
        } catch {}
      }, 800);
    } catch (err) {
      console.warn('Test speaker error:', err);
    }
  }

  public stop() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    if (this.currentOscillator) {
      try {
        this.currentOscillator.stop();
        this.currentOscillator.disconnect();
      } catch {}
      this.currentOscillator = null;
    }
    if (this.currentGain) {
      try {
        this.currentGain.disconnect();
      } catch {}
      this.currentGain = null;
    }
    this.isAlarmPlaying = false;
  }
}

export const audioAlarm = new AudioAlarmSynthesizer();
