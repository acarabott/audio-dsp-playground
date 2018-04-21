/* global CodeMirror, AudioWorkletNode, CustomAudioNode */

let audio;
let customNode;

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
    customNode.disconnect(audio.desination);
    customNode = undefined;
  }
}

try {
  // have to use class Expression if inside a try
  // doing this to catch unsupported browsers
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
  const container = document.getElementById("container");

  const runButton = document.createElement("button");
  runButton.textContent = `Run: ${runKeys.replace("-", " ")}`;

  const stopKeys = isMac ? "Cmd-." : "Ctrl-.";
  const stopButton = document.createElement("button");
  stopButton.textContent = `Stop: ${stopKeys.replace("-", " ")}`;

  let processorCount = 0;

  function runEditorCode(editor) {
    const userCode = editor.getDoc().getValue();
    const processorName = `processor-${processorCount++}`;
    const code = createProcessorCode(userCode, processorName);
    const blob = new Blob([code], { type: "application/javascript" });
    const url = window.URL.createObjectURL(blob);

    runAudioWorklet(url, processorName);
  }

  function playAudio(editor) {
    stopAudio();
    runEditorCode(editor);
  }

  // code mirror
  const editor = CodeMirror(container, {
    mode: "javascript",
    value: defaultUserCode,
    lineNumbers: true,
    lint: { esversion: 6 },
    extraKeys: {
      [runKeys]: () => playAudio(editor),
      [stopKeys]: () => stopAudio(),
    }
  });

  container.appendChild(runButton);
  runButton.addEventListener("click", () => playAudio(editor));

  container.appendChild(stopButton);
  stopButton.addEventListener("click", () => stopAudio());
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.AudioContext === undefined || window.AudioWorklet === undefined) {
    document.getElementById("sampleRateMsg").remove();
    document.getElementById("crashWarning").remove();
  }
  else {
    document.getElementById("unsupported").remove();
    audio = new AudioContext();
    resumeContextOnInteraction(audio);
    document.getElementById("sampleRate").textContent = audio.sampleRate;
    createEditor();
  }
});
