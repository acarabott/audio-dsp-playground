/* global CodeMirror, AudioWorkletNode, Scope */

import { Scope } from "./Scope.js";

let audio;
let customNode;
let CustomAudioNode;
let analyserLeft;
let analyserRight;
let analyserSum;

const presets = [
    {
      name: "White Noise",
      code: `dsp.loop = (numFrames, outL, outR) => {
  const amp = 0.1;
  for (let i = 0; i < numFrames; i++) {
    const noise = Math.random() * 2 - 1;
    outL[i] = noise * amp;
    outR[i] = noise * amp;
  }
};
`
    },
  {
    name: "Sine Wave",
    code: `dsp.setup = (state, sampleRate) => {
  state.time = 0;
};

dsp.loop = (numFrames, outL, outR, sampleRate, state) => {
  const freq = 666;
  const amp = 0.1;

  for (let i = 0; i < numFrames; i++) {
    const sineL = Math.sin(2 * Math.PI * freq * state.time);
    outL[i] = sineL * amp;

    const sineR = Math.sin(2 * Math.PI * freq * 1.5 * state.time);
    outR[i] = sineR * amp;

    state.time += 1 / sampleRate;
  }
};
`
  }
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
}

function getCode(userCode, sampleRate, processorName) {
  return `

  const dsp = {
    setup(state, sampleRate) {},
    loop(numFrames, outL, outR, sampleRate, state) {}
  };

  ${userCode}

  class CustomProcessor extends AudioWorkletProcessor {
    constructor() {
      super();

      this.sampleRate = ${sampleRate};
      this.state = {};
      dsp.setup(this.state, this.sampleRate);
    }

    process(inputs, outputs, parameters) {
      const outL = outputs[0][0];
      const outR = outputs[0][1];
      const numFrames = outL.length;

      dsp.loop(numFrames, outL, outR, this.sampleRate, this.state);

      return true;
    }
  }

  registerProcessor("${processorName}", CustomProcessor);`;
}

function runAudioWorklet(workletUrl, processorName) {
  audio.audioWorklet.addModule(workletUrl).then(() => {
    stopAudio();
    customNode = new CustomAudioNode(audio, processorName);
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
  controlsEl.appendChild(runButton);
  runButton.addEventListener("click", () => playAudio(editor));

  controlsEl.appendChild(stopButton);
  stopButton.addEventListener("click", () => stopAudio());

  presets.forEach(preset => {
    const button = createButton(preset.name);
    button.addEventListener("click", () => editor.getDoc().setValue(preset.code));
    document.getElementById("presets").appendChild(button);
  });
}

function createScopes() {
  const scopesContainer = document.getElementById("scopes");

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

document.addEventListener("DOMContentLoaded", () => {
  if (window.AudioContext === undefined || window.AudioWorklet === undefined) {
    document.getElementById("sampleRateMsg").remove();
    document.getElementById("crashWarning").remove();
  }
  else {
    document.getElementById("unsupported").remove();

    CustomAudioNode = class CustomAudioNode extends AudioWorkletNode {
      constructor(audioContext, processorName) {
        super(audioContext, processorName, {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });
      }
    };

    audio = new AudioContext();
    resumeContextOnInteraction(audio);

    createScopes();
    createEditor(audio.sampleRate);
  }
});
