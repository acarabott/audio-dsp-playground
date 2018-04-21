// https://codepen.io/ContemporaryInsanity/pen/Mwvqpb

export class Scope {
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

    // key

    toRender.forEach(({ style, label }, i) => {
      if (label === undefined) { return; }

      const dim = 15;
      const gap = 10;
      const y = (i * dim) + (gap * i);
      this.ctx.fillStyle = style;

      this.ctx.fillRect(horzStep, y, dim, dim);

      this.ctx.fillStyle = "black";
      this.ctx.textBaseline = "top";
      this.ctx.textAlign = "left";
      this.ctx.font = `${dim}px Courier`;
      this.ctx.fillText(label, horzStep + dim + gap, y);
    });
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

  }

  onResize() {
    this.canvasWidth = this.container.clientWidth;
    this.canvasHeight = this.container.clientHeight;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
  }
}
