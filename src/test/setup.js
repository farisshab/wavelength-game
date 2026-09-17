import '@testing-library/jest-dom/vitest';

// App.jsx unlocks a Web Audio AudioContext on the user's first click/touch
// (needed for Safari/iOS). jsdom doesn't implement AudioContext at all, so
// without this stub, clicking anything in a component test throws.
class MockAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
  }
  createOscillator() {
    return {
      type: "",
      frequency: { value: 0 },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
    };
  }
  resume() {
    return Promise.resolve();
  }
}
window.AudioContext = MockAudioContext;

