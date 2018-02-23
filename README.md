# Audio Worklet Live Coding

Does what it says on the tin.

[Demo](https://acarabott.github.io/audio-worklet-live-coding/)

## How it works

Takes the output of CodeMirror, turns it into a Blob, generates a URL for the Blob, loads it as an a module.

Each time the script is loaded a new id is generated for the processor, and this is passed to the `CustomAudioNode` constructor. Hence not being able to change the name of `CustomAudioNode`.

### Limitations

Stereo output, no inputs. This would only require adding some additional UI boxes and passing the values to `CustomAudioNode`, but isn't really necessary for this demo.

## Libs

- [CodeMirror](codemirror.net)
- [JSHint](http://jshint.com/)

## Author

Arthur Carabott [arthurcarabott.com](http://arthurcarabott.com)
