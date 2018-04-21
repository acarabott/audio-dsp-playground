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
    name: "Sine Wave",
    code: `function setup() {
  this.time = 0;
}

function loop() {
  const freq = 666;
  const amp = 0.1;

  for (let i = 0; i < numFrames; i++) {
    const sineL = Math.sin(2 * Math.PI * freq * this.time);
    outL[i] = sineL * amp;

    const sineR = Math.sin(2 * Math.PI * freq * 1.5 * this.time);
    outR[i] = sineR * amp;

    this.time += 1 / sampleRate;
  }
}
  `
  },

  {
    name: "White Noise",
    code: `function loop() {
  const amp = 0.1;
  for (let i = 0; i < numFrames; i++) {
    const noise = Math.random() * 2 - 1;
    outL[i] = noise * amp;
    outR[i] = noise * amp;
  }
}
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

function getCode(setupCode, loopCode, sampleRate, processorName) {
  return `class CustomProcessor extends AudioWorkletProcessor {
    constructor() {
      super();

      (${setupCode}).call(this);
    }

    process(inputs, outputs, parameters) {
      const sampleRate = ${sampleRate};
      const outL = outputs[0][0];
      const outR = outputs[0][1];
      const numFrames = outL.length;

      (${loopCode}).call(this);

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
  addKeyCommandToButton(runButton, runKeys);

  const stopKeys = isMac ? "Cmd-." : "Ctrl-.";
  const stopButton = createButton("Stop: ");
  addKeyCommandToButton(stopButton, stopKeys);

  let processorCount = 0;

  function splitCode(code) {
    function cleanFunction(functionString) {
      let clean = functionString.trim();

      if (clean.length === 0) { return "() => {}"; }

      if (clean[clean.length - 1] === ";") {
        clean = clean.slice(0, clean.length - 1);
      }

      return clean;
    }

    const split = code.search(/function\s*loop\s*\(/);
    const setupCode = cleanFunction(code.slice(0, split));
    const loopCode = cleanFunction(code.slice(split));

    return { setupCode, loopCode };
  }

  function runEditorCode(editor) {
    const { setupCode, loopCode } = splitCode(editor.getDoc().getValue());
    const processorName = `processor-${processorCount++}`;
    const code = getCode(setupCode, loopCode, sampleRate, processorName);
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
    lint: { esversion: 6 }
  });

  document.addEventListener("keydown", event => {
    const isModDown = isMac ? event.metaKey : event.ctrlKey;

    if (!isModDown) { return; }

    const isEnter = event.code === "Enter";
    const isPeriod = event.code === "Period";

    if (isEnter || isPeriod) { event.preventDefault(); }
         if (isEnter)  { playAudio(editor); }
    else if (isPeriod) { stopAudio(); }
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
  analyserLeft.fftSize = 2048;

  analyserRight = audio.createAnalyser();
  analyserRight.fftSize = 2048;

  const scopeMono = new Scope();
  scopeMono.appendTo(scopesContainer);

  analyserSum = audio.createAnalyser();
  analyserSum.fftSize = 2048;
  const scopeSum = new Scope();
  scopeSum.appendTo(scopesContainer);


  function loop() {
    scopeMono.renderScope([
      {
        label: "Left",
        analyser: analyserLeft,
        style: "rgb(43, 156, 212)",
        edgeThreshold: 0
      },
      {
        label: "Right",
        analyser: analyserRight,
        style: "rgb(249, 182, 118)",
        edgeThreshold: 0,
      }
    ]);

    scopeSum.renderScope([{
      label: "Sum",
      analyser: analyserSum,
      style: "rgb(212, 100, 100)",
      edgeThreshold: 0.09
    }]);
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
