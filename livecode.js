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
  });
}

function createEditor(sampleRate) {
  const isMac = CodeMirror.keyMap.default === CodeMirror.keyMap.macDefault;

  function createButton(text, keyCommand) {
    const button = document.createElement("button");
    button.textContent = text;
    keyCommand.split("-").forEach(key => {
      const el = document.createElement("kbd");
      el.classList.add("key");
      el.textContent = key.toLowerCase();
      button.appendChild(el);
    });


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

  const runKeys = isMac ? "Cmd-Enter" : "Ctrl-Enter";
  const runButton = createButton("Run: ", runKeys);

  const stopKeys = isMac ? "Cmd-." : "Ctrl-.";
  const stopButton = createButton("Stop: ", stopKeys);

  let processorCount = 0;

  function splitCode(code) {
    const split = code.search(/function\s*loop\s*\(/);

    return {
      setupCode: code.slice(0, split),
      loopCode:  code.slice(split)
    };
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

  const defaultUserCode = `function setup() {
  this.time = 0;
}

function loop() {
  const freq = 666;
  const amp = 0.1;

  for (let i = 0; i < numFrames; i++) {
    const sine = Math.sin(2 * Math.PI * freq * this.time);
    outL[i] = sine * amp;
    outR[i] = sine * amp;

    this.time += 1 / sampleRate;
  }
}
  `;

  // code mirror
  const editorWrap = document.getElementById("editor");
  const loopEditor = CodeMirror(editorWrap, {
    mode: "javascript",
    value: defaultUserCode,
    lineNumbers: true,
    lint: { esversion: 6 },
    extraKeys: {
      [runKeys]: () => playAudio(loopEditor),
      [stopKeys]: () => stopAudio(),
    }
  });

  editorWrap.appendChild(runButton);
  runButton.addEventListener("click", () => playAudio(loopEditor));

  editorWrap.appendChild(stopButton);
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
