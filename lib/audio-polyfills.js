// General Web Audio API polyfills / fixes for Safari:
if (typeof AudioContext==='undefined' && typeof webkitAudioContext!=='undefined') {
	AudioContext = webkitAudioContext;
}
if (typeof AnalyserNode!=='undefined' && !AnalyserNode.prototype.getFloatTimeDomainData) {
	var uint8 = new Uint8Array(2048);
	AnalyserNode.prototype.getFloatTimeDomainData = function(f) {
		this.getByteTimeDomainData(uint8);
		for (var i=f.length; i--; ) f[i] = (uint8[i] - 128) * 0.0078125;
	};
}
