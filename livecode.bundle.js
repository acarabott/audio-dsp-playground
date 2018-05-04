(function () {
  'use strict';

  // https://codepen.io/ContemporaryInsanity/pen/Mwvqpb

  class Scope {
    constructor() {
      this.container = document.createElement("div");
      this.container.classList.add("scope");

      this.canvas = document.createElement("canvas");
      this.canvas.style.transformOrigin = "top left";
      this.ctx = this.canvas.getContext("2d");
      this.onResize = this.onResize.bind(this);

      this.container.appendChild(this.canvas);
      this.onResize();
      window.addEventListener("resize", this.onResize);
    }

    get canvasWidth() { return this.canvas.width / devicePixelRatio; }
    set canvasWidth(canvasWidth) {
      this.canvas.width = Math.floor(canvasWidth * devicePixelRatio);
      this.canvas.style.width = `${canvasWidth}px`;
    }

    get canvasHeight() { return this.canvas.height / devicePixelRatio; }
    set canvasHeight(canvasHeight) {
      this.canvas.height = Math.floor(canvasHeight * devicePixelRatio);
      this.canvas.style.height = `${canvasHeight}px`;
    }

    appendTo(element) {
      element.appendChild(this.container);
      this.onResize();
    }

    // array of objects { analyser, strokeStyle, edgeThreshold }
    renderScope(toRender = []) {
      // grid
      this.ctx.fillStyle = "white";
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
      this.ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
      this.ctx.beginPath();

      const numHorzSteps = 8;
      const horzStep = this.canvasWidth / numHorzSteps;
      for (let i = horzStep; i < this.canvasWidth; i += horzStep) {
        this.ctx.moveTo(i, 0);
        this.ctx.lineTo(i, this.canvasHeight);
      }

      const numVertSteps = 4;
      const vertStep = this.canvasHeight / numVertSteps;
      for (let i = 0; i < this.canvasHeight; i += vertStep) {
        this.ctx.moveTo(0, i);
        this.ctx.lineTo(this.canvasWidth, i);
      }
      this.ctx.stroke();

      // 0 line
      this.ctx.strokeStyle = "rgba(100, 100, 100, 0.5)";
      this.ctx.beginPath();
      this.ctx.lineWidth = 2;
      this.ctx.moveTo(0, this.canvasHeight / 2);
      this.ctx.lineTo(this.canvasWidth, this.canvasHeight / 2);
      this.ctx.stroke();

      // waveforms

      toRender.forEach(({ analyser, style = "rgb(43, 156, 212)", edgeThreshold = 0 }) => {
        if (analyser === undefined) { return; }

        const timeData = new Float32Array(analyser.frequencyBinCount);
        let risingEdge = 0;

        analyser.getFloatTimeDomainData(timeData);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = style;

        this.ctx.beginPath();

        while (timeData[risingEdge] > 0 &&
               risingEdge <= this.canvasWidth &&
               risingEdge < timeData.length) {
          risingEdge++;
        }

        if (risingEdge >= this.canvasWidth) { risingEdge = 0; }


        while (timeData[risingEdge] < edgeThreshold &&
               risingEdge <= this.canvasWidth  &&
               risingEdge< timeData.length) {
          risingEdge++;
        }

        if (risingEdge >= this.canvasWidth) { risingEdge = 0; }

        for (let x = risingEdge; x < timeData.length && x - risingEdge < this.canvasWidth; x++) {
          const y = this.canvasHeight - (((timeData[x] + 1) / 2) * this.canvasHeight);
          this.ctx.lineTo(x - risingEdge, y);
        }

        this.ctx.stroke();
      });

      // markers
      this.ctx.fillStyle = "black";
      this.ctx.font = "11px Courier";
      this.ctx.textAlign = "left";
      const numMarkers = 4;
      const markerStep = this.canvasHeight / numMarkers;
      for (let i = 0; i <= numMarkers; i++) {
        this.ctx.textBaseline = i === 0          ? "top"
                              : i === numMarkers ? "bottom"
                              :                    "middle";

        const value = ((numMarkers - i) - (numMarkers / 2)) / numMarkers * 2;
        this.ctx.textAlign = "left";
        this.ctx.fillText(value, 5, i * markerStep);
        this.ctx.textAlign = "right";
        this.ctx.fillText(value, this.canvasWidth - 5, i * markerStep);
      }
    }

    renderSpectrum(analyser) {
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      analyser.getByteFrequencyData(freqData);

      this.ctx.fillStyle = "white";
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "rgb(43, 156, 212)";
      this.ctx.beginPath();

      for (let i = 0; i < freqData.length; i++) {
        const x = (Math.log(i / 1)) / (Math.log(freqData.length / 1)) * this.canvasWidth;
        const height = (freqData[i] * this.canvasHeight) / 256;
        this.ctx.lineTo(x, this.canvasHeight - height);
      }
      this.ctx.stroke();

      const fontSize = 12;

      // frequencies
      function explin(value, inMin, inMax, outMin, outMax) {
        inMin = Math.max(inMin, 1);
        outMin = Math.max(outMin, 1);
        return Math.log10(value / inMin) / Math.log10(inMax / inMin) * (outMax - outMin) + outMin;
      }

      const nyquist = analyser.context.sampleRate / 2;
      [0, 100, 300, 1000, 3000, 10000, 20000].forEach(freq => {
        const minFreq = 20;
        const x = freq <= 0
          ? fontSize - 5
          : explin(freq, minFreq, nyquist, 0, this.canvasWidth);

        this.ctx.fillStyle = "black";
        this.ctx.textBaseline = "middle";
        this.ctx.textAlign = "right";
        this.ctx.font = `${fontSize}px Courier`;
        this.ctx.save();
        this.ctx.translate(x, this.canvasHeight - 5);
        this.ctx.rotate(Math.PI * 0.5);
        this.ctx.fillText(`${freq.toFixed(0)}hz`, 0, 0);
        this.ctx.restore();
      });

      [0, -3, -6, -12].forEach(db => {
        const x = 5;
        const amp = Math.pow(10, db * 0.05);
        const y = (1 - amp) * this.canvasHeight;

        this.ctx.fillStyle = "black";
        this.ctx.textBaseline = "top";
        this.ctx.textAlign = "left";
        this.ctx.font = `${fontSize}px Courier`;
        this.ctx.fillText(`${db.toFixed(0)}db`, x, y);
      });

    }

    onResize() {
      this.canvasWidth = 0;
      this.canvasHeight = 0;

      const rect = this.container.getBoundingClientRect();
      const style = getComputedStyle(this.container);

      let borderLeft = style.getPropertyValue("border-left-width");
      borderLeft = borderLeft === "" ? 0 : parseFloat(borderLeft, 10);
      let borderRight = style.getPropertyValue("border-right-width");
      borderRight = borderRight === "" ? 0 : parseFloat(borderRight, 10);
      this.canvasWidth = rect.width - borderLeft - borderRight;

      let borderTop = style.getPropertyValue("border-top-width");
      borderTop = borderTop === "" ? 0 : parseFloat(borderTop, 10);
      let borderBottom = style.getPropertyValue("border-bottom-width");
      borderBottom = borderBottom === "" ? 0 : parseFloat(borderBottom, 10);
      this.canvasHeight = rect.height - borderTop - borderBottom;

      this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }
  }

  /* global CodeMirror, AudioWorkletNode */

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
      code: `// adapted from https://googlechromelabs.github.io/web-audio-samples/audio-worklet/basic/bit-crusher.html
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

  function createPlayer() {
    const fileInput = document.getElementById("input");
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length === 0 ) { return; }

      const blobReader = new FileReader();
      blobReader.addEventListener("load", event => {
        audio.decodeAudioData(event.target.result).then(buffer => {
          sourceBuffer = buffer;
          const channelsEl = document.getElementById("numChannels");
          const isMono = buffer.numberOfChannels === 1;
          channelsEl.innerHTML = isMono
            ? "Mono audio file, <code>outR</code> will be <code>undefined</code>"
            : "";
          channelsEl.style.display = isMono ? "inline-block" : "none";
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
      channelsEl.style.display = "none";
    });
    document.getElementById("remove-parent").appendChild(removeButton);
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

}());
