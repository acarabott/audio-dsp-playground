// https://codepen.io/ContemporaryInsanity/pen/Mwvqpb

export class Scope {
  constructor(analyser, label="", containerClass="") {
    this.analyser = analyser;

    this.container = document.createElement("div");
    this.container.classList.add("scope");
    this.container.classList.add(containerClass);

    const labelEl = document.createElement("h3");
    labelEl.textContent = label;

    this.canvas = document.createElement("canvas");
    this.canvas.style.transformOrigin = "top left";
    this.ctx = this.canvas.getContext("2d");
    this.onResize = this.onResize.bind(this);

    this.strokeStyle = "rgb(43, 156, 212)";
    this._edgeThreshold = 0.14;

    const controls = document.createElement("div");
    controls.classList.add("controls");

    const edgeThresholdSlider = document.createElement("input");
    edgeThresholdSlider.type = "range";
    edgeThresholdSlider.min = -1;
    edgeThresholdSlider.max = 1;
    edgeThresholdSlider.value = 0;
    edgeThresholdSlider.step = 0.01;

    this.edgeThresholdLabel = document.createElement("div");
    this.edgeThresholdLabel.textContent = "Adjust stability";

    this.edgeThresholdValue = document.createElement("div");

    edgeThresholdSlider.addEventListener("input", () => {
      this.edgeThreshold = edgeThresholdSlider.valueAsNumber;
    });
    this.edgeThreshold = 0.14;

    this.container.appendChild(labelEl);
    this.container.appendChild(this.canvas);
    controls.appendChild(this.edgeThresholdLabel);
    controls.appendChild(edgeThresholdSlider);
    controls.appendChild(this.edgeThresholdValue);
    this.container.appendChild(controls);

    this.onResize();
    window.addEventListener("resize", this.onResize);
  }

  get edgeThreshold() { return this._edgeThreshold; }
  set edgeThreshold(edgeThreshold) {
    this._edgeThreshold = edgeThreshold;
    this.edgeThresholdValue.textContent = `${this.edgeThreshold.toFixed(2)}`;

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

  renderScope() {
    // grid
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    this.ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
    this.ctx.beginPath();

    {
      const numSteps = 8;
      const step = this.canvasWidth / numSteps;
      for (let i = step; i < this.canvasWidth; i += step) {
        this.ctx.moveTo(i, 0);
        this.ctx.lineTo(i, this.canvasHeight);
      }
    }
    {
      const numSteps = 4;
      const step = this.canvasHeight / numSteps;
      for (let i = 0; i < this.canvasHeight; i += step) {
        this.ctx.moveTo(0, i);
        this.ctx.lineTo(this.canvasWidth, i);
      }
    }
    this.ctx.stroke();

    // 0 line
    this.ctx.strokeStyle = "rgba(100, 100, 100, 0.5)";
    this.ctx.beginPath();
    this.ctx.lineWidth = 2;
    this.ctx.moveTo(0, this.canvasHeight / 2);
    this.ctx.lineTo(this.canvasWidth, this.canvasHeight / 2);
    this.ctx.stroke();

    // waveform
    const timeData = new Float32Array(this.analyser.frequencyBinCount);
    let risingEdge = 0;

    this.analyser.getFloatTimeDomainData(timeData);

    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = this.strokeStyle;
    this.ctx.beginPath();

    while (timeData[risingEdge] > 0 &&
           risingEdge <= this.canvasWidth &&
           risingEdge < timeData.length) {
      risingEdge++;
    }

    if (risingEdge >= this.canvasWidth) { risingEdge = 0; }

    while (timeData[risingEdge] < this.edgeThreshold &&
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

  renderSpectrum() {
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    var freqData = new Uint8Array(analyser.frequencyBinCount);
    var scaling = height / 256;

    analyser.getByteFrequencyData(freqData);

    ctx.fillStyle = 'rgba(0, 20, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(0, 200, 0)';
    ctx.beginPath();

    for (var x = 0; x < width; x++)
      ctx.lineTo(x, height - freqData[x] * scaling);

    ctx.stroke();
  }

  onResize() {
    this.canvasWidth = this.container.clientWidth;
    this.canvasHeight = this.container.clientHeight * 0.7;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
  }
}
