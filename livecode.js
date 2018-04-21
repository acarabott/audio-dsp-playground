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

function getCode(setupCode, dspCode, sampleRate) {
  return `class CustomProcessor extends AudioWorkletProcessor {
    constructor() {
      super();

      ${setupCode};
    }

    process(inputs, outputs, parameters) {
      const sampleRate = ${sampleRate};
      const outL = outputs[0][0];
      const outR = outputs[0][1];
      const numFrames = outL.length;

      ${dspCode}

      return true;
    }
  }`;
}

const defaultSetupCode = `this.freq = 666;
this.amp = 0.1;
this.time = 0;`;

const defaultLoopCode = `for (let i = 0; i < numFrames; i++) {
  const sine = Math.sin(2 * Math.PI * this.freq * this.time);
  outL[i] = sine * this.amp;
  outR[i] = sine * this.amp;

  this.time += 1 / sampleRate;
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

function createEditor(sampleRate) {
  const isMac = CodeMirror.keyMap.default === CodeMirror.keyMap.macDefault;
  const runKeys = isMac ? "Cmd-Enter" : "Ctrl-Enter";
  const setupWrap = document.getElementById("setup");
  const loopWrap = document.getElementById("loop");

  const runButton = document.createElement("button");
  runButton.textContent = `Run: ${runKeys.replace("-", " ")}`;

  const stopKeys = isMac ? "Cmd-." : "Ctrl-.";
  const stopButton = document.createElement("button");
  stopButton.textContent = `Stop: ${stopKeys.replace("-", " ")}`;

  let processorCount = 0;

  function runEditorCode(editor) {
    const userCode = getCode(editor.getDoc().getValue(), sampleRate);
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
  const setupEditor = CodeMirror(setupWrap, {
    mode: "javascript",
    value: defaultSetupCode,
    lineNumbers: true,
    lint: { esversion: 6 },
    extraKeys: {
      [runKeys]: () => playAudio(setupEditor),
      [stopKeys]: () => stopAudio(),
    }
  });

  const loopEditor = CodeMirror(loopWrap, {
    mode: "javascript",
    value: defaultLoopCode,
    lineNumbers: true,
    lint: { esversion: 6 },
    extraKeys: {
      [runKeys]: () => playAudio(loopEditor),
      [stopKeys]: () => stopAudio(),
    }
  });

  loopWrap.appendChild(runButton);
  runButton.addEventListener("click", () => playAudio(loopEditor));

  loopWrap.appendChild(stopButton);
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
    createEditor(audio.sampleRate);
  }
});
