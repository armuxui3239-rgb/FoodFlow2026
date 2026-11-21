/**
 * Custom AudioWorkletProcessor สำหรับประมวลผลเสียงโทรบน Audio Thread แยก
 * กฎเหล็ก: ห้ามจัดสรรหน่วยความจำ (new, [], {}) ภายในเมธอด process() เพื่อป้องกัน Audio Dropouts
 */
class FoodFlowDspProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = true;
    this.gateThreshold = 0.0025; // ~ -52 dBFS noise gate
    this.limiterCeiling = 0.88;
    this.envelope = 0;

    this.port.onmessage = (event) => {
      if (event && event.data && event.data.type === 'stop') {
        this.active = false;
      }
    };
  }

  process(inputs, outputs) {
    if (!this.active) {
      return false;
    }

    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output) {
      return true;
    }

    const channelCount = Math.min(input.length, output.length);
    const gateThreshold = this.gateThreshold;
    const ceiling = this.limiterCeiling;

    for (let ch = 0; ch < channelCount; ch += 1) {
      const inBuf = input[ch];
      const outBuf = output[ch];
      if (!inBuf || !outBuf) continue;

      const len = inBuf.length;
      for (let i = 0; i < len; i += 1) {
        const sample = inBuf[i];
        const absVal = sample < 0 ? -sample : sample;

        // Smooth envelope follower
        if (absVal > this.envelope) {
          this.envelope = this.envelope * 0.85 + absVal * 0.15;
        } else {
          this.envelope = this.envelope * 0.995 + absVal * 0.005;
        }

        // Soft noise gate
        let processed = this.envelope < gateThreshold ? sample * 0.15 : sample;

        // Soft knee limiter ป้องกันเสียงแตก
        if (processed > ceiling) {
          processed = ceiling + (processed - ceiling) / (1 + (processed - ceiling) * 4);
        } else if (processed < -ceiling) {
          processed = -ceiling + (processed + ceiling) / (1 - (processed + ceiling) * 4);
        }

        outBuf[i] = processed;
      }
    }

    return true;
  }
}

registerProcessor('foodflow-dsp-processor', FoodFlowDspProcessor);
