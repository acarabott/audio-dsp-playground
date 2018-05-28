/* global CodeMirror, AudioWorkletNode */

import { Scope } from "./Scope.js";

let audio;
let customNode;
let sourceBuffer;
let bufferSourceNode;
let bufferSourceNodeStartTime = 0;
let bufferSourceNodeOffset = 0;
let CustomAudioNode;
let analyserLeft;
let analyserRight;
let analyserSum;


const presets = [
  {
    name: "White Noise",
    code: `function loop(numFrames, outL, outR, sampleRate) {
  const amp = 0.1;
  for (let i = 0; i < numFrames; i++) {
    const noise = Math.random() * 2 - 1;
    outL[i] = noise * amp;
    outR[i] = noise * amp;
  }
}
`
  },
  {
    name: "Sine Wave",
    code: `let time = 0;

function getSine(freq, time) {
  return Math.sin(2 * Math.PI * freq * time);
}

function loop(numFrames, outL, outR, sampleRate) {
  const freq = 666;
  const amp = 0.1;

  for (let i = 0; i < numFrames; i++) {
    outL[i] = getSine(freq      , time) * amp;
    outR[i] = getSine(freq * 1.5, time) * amp;

    time += 1 / sampleRate;
  }
}
`
  },
  {
    name: "Bitcrusher",
    code: `// Load an audio file above
// adapted from https://googlechromelabs.github.io/web-audio-samples/audio-worklet/basic/bit-crusher.html
const bitDepth = 4;
const frequencyReduction = 0.1;

let phase = 0;
let lastSampleValueL = 0;
let lastSampleValueR = 0;

function crush(sample, step) {
  return step * Math.floor(sample / step + 0.5);
}

function loop(numFrames, outL, outR, sampleRate, inL, inR) {
  const isMono = inR === undefined;

  for (let i = 0; i < numFrames; ++i) {
    const step = Math.pow(0.5, bitDepth);
    phase += frequencyReduction;
    if (phase >= 1.0) {
      phase -= 1.0;
      lastSampleValueL = crush(inL[i], step);
      lastSampleValueR = isMono ? lastSampleValueL : crush(inR[i], step);
    }

    outL[i] = lastSampleValueL;
    if (!isMono) {
      outR[i] = lastSampleValueR;
    }
  }
}
`
    },
];

function resumeContextOnInteraction(audioContext) {
  // from https://github.com/captbaritone/winamp2-js/blob/a5a76f554c369637431fe809d16f3f7e06a21969/js/media/index.js#L8-L27
  if (audioContext.state === "suspended") {
    const resume = async () => {
      await audioContext.resume();

      if (audioContext.state === "running") {
        document.body.removeEventListener("touchend", resume, false);
        document.body.removeEventListener("click", resume, false);
        document.body.removeEventListener("keydown", resume, false);
      }
    };

    document.body.addEventListener("touchend", resume, false);
    document.body.addEventListener("click", resume, false);
    document.body.addEventListener("keydown", resume, false);
  }
}

function stopAudio() {
  if (customNode !== undefined) {
    customNode.disconnect();
    customNode = undefined;
  }

  if (bufferSourceNode !== undefined) {
    bufferSourceNodeOffset = audio.currentTime - bufferSourceNodeStartTime;
    bufferSourceNode.stop();
    bufferSourceNode.disconnect();
  }
}

function getCode(userCode, sampleRate, processorName) {
  return `

  ${userCode}

  class CustomProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
    }

    process(inputs, outputs, parameters) {
      const inL = inputs[0][0];
      const inR = inputs[0][1];
      const outL = outputs[0][0];
      const outR = outputs[0][1];
      const numFrames = outL.length;

      loop(numFrames, outL, outR, sampleRate, inL, inR);

      return true;
    }
  }

  registerProcessor("${processorName}", CustomProcessor);`;
}

function runAudioWorklet(workletUrl, processorName) {
  audio.audioWorklet.addModule(workletUrl).then(() => {
    stopAudio();

    customNode = new CustomAudioNode(audio, processorName);

    if (sourceBuffer !== undefined) {
      bufferSourceNode = audio.createBufferSource();
      bufferSourceNode.buffer = sourceBuffer;
      bufferSourceNode.loop = true;
      bufferSourceNode.connect(customNode);
      bufferSourceNode.start(audio.currentTime, bufferSourceNodeOffset);
      bufferSourceNodeStartTime = audio.currentTime - bufferSourceNodeOffset;
    }

    customNode.connect(audio.destination);

    const analysisSplitter = audio.createChannelSplitter(2);
    customNode.connect(analysisSplitter);
    analysisSplitter.connect(analyserLeft, 0);
    analysisSplitter.connect(analyserRight, 1);
    customNode.connect(analyserSum);
  });
}

function createButton(text) {
  const button = document.createElement("button");
  button.textContent = text;

  const onMouseUp = () => {
    button.classList.remove("down");
    document.removeEventListener("mouseup", onMouseUp, false);
  };

  const onMouseDown = () => {
    button.classList.add("down");
    document.addEventListener("mouseup", onMouseUp, false);
  };

  button.addEventListener("mousedown", onMouseDown);

  return button;
}

function createToggle(text, _onMouseUp = () => {}) {
  const button = document.createElement("button");
  button.classList.add("toggle");
  button.textContent = text;

  const onMouseUp = event => {
    button.classList.remove("down");

    if (event.target === button) {
      button.classList.contains("active")
        ? button.classList.remove("active")
        : button.classList.add("active");
    }

    _onMouseUp(button.classList.contains("active"));
    document.removeEventListener("mouseup", onMouseUp, false);
  };

  const onMouseDown = () => {
    button.classList.add("down");
    document.addEventListener("mouseup", onMouseUp, false);
  };

  button.addEventListener("mousedown", onMouseDown);

  return button;
}


function addKeyCommandToButton(button, keyCommand) {
  keyCommand.split("-").forEach(key => {
    const el = document.createElement("kbd");
    el.classList.add("key");
    el.textContent = key.toLowerCase();
    button.appendChild(el);
  });
}

function createEditor(sampleRate) {
  const isMac = CodeMirror.keyMap.default === CodeMirror.keyMap.macDefault;

  const runKeys = isMac ? "Cmd-Enter" : "Ctrl-Enter";
  const runButton = createButton("Run: ");
  runButton.classList.add("run");
  addKeyCommandToButton(runButton, runKeys);

  const stopKeys = isMac ? "Cmd-." : "Ctrl-.";
  const stopButton = createButton("Stop: ");
  stopButton.classList.add("stop");
  addKeyCommandToButton(stopButton, stopKeys);

  let processorCount = 0;

  function runEditorCode(editor) {
    const userCode = editor.getDoc().getValue();
    const processorName = `processor-${processorCount++}`;
    const code = getCode(userCode, sampleRate, processorName);
    const blob = new Blob([code], { type: "application/javascript" });
    const url = window.URL.createObjectURL(blob);

    runAudioWorklet(url, processorName);
  }

  function playAudio(editor) {
    stopAudio();
    runEditorCode(editor);
  }

  // code mirror
  const editorWrap = document.getElementById("editor");
  if (editorWrap === null) { return; }
  const editor = CodeMirror(editorWrap, {
    mode: "javascript",
    value: presets[0].code,
    lineNumbers: true,
    lint: { esversion: 6 },
    viewportMargin: Infinity,
    tabSize: 2
  });

  document.addEventListener("keydown", event => {
    const isModDown = isMac ? event.metaKey : event.ctrlKey;

    if (!isModDown) { return; }

    const isEnter = event.code === "Enter";
    const isPeriod = event.code === "Period";

    if (isEnter || isPeriod) { event.preventDefault(); }

    if (isEnter)  {
      playAudio(editor);
      runButton.classList.add("down");
      setTimeout(() => {
        if (runButton.classList.contains("down")) {
          runButton.classList.remove("down");
        }
      }, 200);
    }
    else if (isPeriod) {
      stopAudio();
      stopButton.classList.add("down");
      setTimeout(() => {
        if (stopButton.classList.contains("down")) {
          stopButton.classList.remove("down");
        }
      }, 200);

    }
  });

  const controlsEl = document.getElementById("controls");
  if (controlsEl !== null) {
    controlsEl.appendChild(runButton);
    runButton.addEventListener("click", () => playAudio(editor));

    controlsEl.appendChild(stopButton);
    stopButton.addEventListener("click", () => stopAudio());

    presets.forEach(preset => {
      const button = createButton(preset.name);
      button.addEventListener("click", () => editor.getDoc().setValue(preset.code));
      const presetsEl = document.getElementById("presets");
      if (presetsEl !== null) { presetsEl.appendChild(button); }
    });
  }
}

function createScopes() {
  const scopesContainer = document.getElementById("scopes");
  if (scopesContainer === null) { return; }

  analyserLeft = audio.createAnalyser();
  window.analyser = analyserLeft;
  analyserLeft.fftSize = Math.pow(2, 11);
  analyserLeft.minDecibels = -96;
  analyserLeft.maxDecibels = 0;
  analyserLeft.smoothingTimeConstant = 0.85;

  analyserRight = audio.createAnalyser();
  analyserRight.fftSize = Math.pow(2, 11);
  analyserRight.minDecibels = -96;
  analyserRight.maxDecibels = 0;
  analyserRight.smoothingTimeConstant = 0.85;

  analyserSum = audio.createAnalyser();
  analyserSum.fftSize = Math.pow(2, 11);
  analyserSum.minDecibels = -96;
  analyserSum.maxDecibels = 0;
  analyserSum.smoothingTimeConstant = 0.85;

  const scopeOsc = new Scope();

  const scopeOscControls = document.createElement("div");
  scopeOscControls.classList.add("osc-controls");

  const toRender = [
    {
      label: "Left",
      analyser: analyserLeft,
      style: "rgba(43, 156, 212, 0.9)",
      edgeThreshold: 0,
      active: true
    },
    {
      label: "Right",
      analyser: analyserRight,
      style: "rgba(249, 182, 118, 0.9)",
      edgeThreshold: 0,
      active: true
    },
    {
      label: "Sum",
      analyser: analyserSum,
      style: "rgb(212, 100, 100)",
      edgeThreshold: 0.09,
      active: false
    }
  ];

  toRender.map(item => {
    const wrap = document.createElement("div");
    wrap.classList.add("scope-control");
    const button = createToggle(item.label, isActive => item.active = isActive);
    button.style.background = item.style;
    button.style.color = "black";
    if (item.active) { button.classList.add("active"); }
    wrap.appendChild(button);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = -1;
    slider.max = 1;
    slider.step = 0.01;
    slider.value = item.edgeThreshold;
    slider.addEventListener("input", () => item.edgeThreshold = slider.valueAsNumber);
    slider.title = "Stability adjustment";
    wrap.appendChild(slider);

    scopeOscControls.appendChild(wrap);
  });

  scopesContainer.appendChild(scopeOscControls);

  scopeOsc.appendTo(scopesContainer);

  const scopeSpectrum = new Scope();
  scopeSpectrum.appendTo(scopesContainer);


  function loop() {
    scopeOsc.renderScope(toRender.filter(item => item.active));

    scopeSpectrum.renderSpectrum(analyserSum);
    requestAnimationFrame(loop);
  }

  loop();
}

function createPlayer() {
  const fileInput = document.getElementById("input");
  if (fileInput === null) { return; }

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length === 0 ) { return; }

    const blobReader = new FileReader();
    blobReader.addEventListener("load", event => {
      audio.decodeAudioData(event.target.result).then(buffer => {
        sourceBuffer = buffer;
        const channelsEl = document.getElementById("numChannels");
        if (channelsEl !== null) {
          const isMono = buffer.numberOfChannels === 1;
          channelsEl.innerHTML = isMono
            ? "Mono audio file, <code>outR</code> will be <code>undefined</code>"
            : "";
          channelsEl.style.display = isMono ? "inline-block" : "none";
        }
      });
    }, false);

    blobReader.readAsArrayBuffer(fileInput.files[0]);

  }, false);

  const removeButton = createButton("X");
  removeButton.id = "remove";
  removeButton.addEventListener("click", () => {
    fileInput.value = null;
    sourceBuffer = undefined;
    const channelsEl = document.getElementById("numChannels");
    if (channelsEl !== null) { channelsEl.style.display = "none"; }
  });
  const removeEl = document.getElementById("remove-parent");
  if (removeEl !== null) { removeEl.appendChild(removeButton); }
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.AudioContext !== undefined && window.AudioWorkletNode !== undefined) {
    const unsupportedEl = document.getElementById("unsupported");
    if (unsupportedEl !== null) { unsupportedEl.remove(); }

    CustomAudioNode = class CustomAudioNode extends AudioWorkletNode {
      constructor(audioContext, processorName) {
        super(audioContext, processorName, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });
      }
    };

    audio = new AudioContext();
    resumeContextOnInteraction(audio);

    createScopes();

    createPlayer();
    createEditor(audio.sampleRate);
  }
});
