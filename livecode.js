/* global CodeMirror, AudioWorkletNode */

let audio;
let customNode;

function stopAudio() {
  if (customNode !== undefined) {
    customNode.disconnect(audio.desination);
    customNode = undefined;
  }
}

try {
  // have to use class Expression if inside a try
  window.CustomAudioNode = class CustomAudioNode extends AudioWorkletNode {
    constructor(audioContext, processorName) {
      super(audioContext, processorName, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
    }
  };
} catch (e) {
  // unsupported
}

const defaultUserCode = `// WARNING: Must be named CustomProcessor
class CustomProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: 'gain',
      defaultValue: 0.1
    }];
  }

  constructor() {
    super();

    // can't actually query this until this.getContextInfo() is implemented
    // update manually if you need it
    this.sampleRate = 44100;
  }

  process(inputs, outputs, parameters) {
    const speakers = outputs[0];

    for (let i = 0; i < speakers[0].length; i++) {
      const noise = Math.random() * 2 - 1;
      const gain = parameters.gain[i];
      speakers[0][i] = noise * gain;
      speakers[1][i] = noise * gain;
    }

    return true;
  }
}`;

function createProcessorCode(userCode, processorName) {
  return `${userCode}

  registerProcessor("${processorName}", CustomProcessor);`;
}

function runAudioWorklet(workletUrl, processorName) {
  audio.audioWorklet.addModule(workletUrl).then(() => {
    stopAudio();
    customNode = new CustomAudioNode(audio, processorName);
    customNode.connect(audio.destination);
  });
}

function createEditor() {
  const isMac = CodeMirror.keyMap.default === CodeMirror.keyMap.macDefault;
  const runKeys = isMac ? "Cmd-Enter" : "Ctrl-Enter";

  const runButton = document.createElement("button");
  runButton.textContent = `Run: ${runKeys.replace("-", " ")}`;
  const container = document.getElementById("container");

  let running = false;
  let processorCount = 0;

  function runEditorCode(editor) {
    const userCode = editor.getDoc().getValue();
    const processorName = `processor-${processorCount++}`;
    const code = createProcessorCode(userCode, processorName);
    const blob = new Blob([code], { type: "application/javascript" });
    const url = window.URL.createObjectURL(blob);

    runAudioWorklet(url, processorName);
  }

  function toggleAudio(editor) {
    stopAudio();
    running = !running;
    if (running) { runEditorCode(editor); }

    const msg = running ? "Stop" : "Run";
    runButton.textContent = `${msg}: ${runKeys.replace("-", " ")}`;
  }

  // code mirror
  const editor = CodeMirror(container, {
    mode: "javascript",
    value: defaultUserCode,
    lineNumbers: true,
    lint: { esversion: 6 },
    extraKeys: {
      [runKeys]: () => toggleAudio(editor),
    }
  });

  container.appendChild(runButton);
  runButton.addEventListener("click", () => {
    toggleAudio(editor);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.AudioContext === undefined || window.AudioWorklet === undefined) {
    document.getElementById("sampleRateMsg").remove();
    document.getElementById("crashWarning").remove();
  }
  else {
    document.getElementById("unsupported").remove();
    audio = new AudioContext();
    document.getElementById("sampleRate").textContent = audio.sampleRate;
    createEditor();
  }
});

