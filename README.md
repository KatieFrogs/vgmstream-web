## vgmstream-web
Brings [vgmstream](https://vgmstream.org/) to web browsers. vgmstream-web is a video game audio player that supports seamlessly looping music playback with various exotic audio formats. Powered by WebAssembly, it supports any platform with a web browser, like a desktop, mobile device, or video game console.

https://katiefrogs.github.io/vgmstream-web/

## URL Arguments
Arguments to vgmstream-web can be passed by appending, after the number sign (`#`), an ampersand (`&`)-separated `name=value` string.

### Supported arguments
- `play`: URL from which to load and play the stream.
- `sub`: Additional file or files that are required for the playback.
- `base`: Base string that prefixes the following URLs.
- `dir`: Renames the previous file.

The arguments can be repeated. Value can be URL-encoded.

### Example URL
`https://katiefrogs.github.io/vgmstream-web/#base=https://example.com/&play=file.txtp&sub=file.wem&dir=wem/file.wem`

This loads files `https://example.com/file.txtp` and `https://example.com/file.wem`, renaming the second one to `wem/file.wem`, and playing the first one.

## Compiling vgmstream-cli.js/.wasm
These instructions have been tested on Ubuntu 21.04, but should also work on other Linux distros.
```sh
# Install packages
sudo apt install git cmake make

# Get Emscripten SDK
git clone https://github.com/emscripten-core/emsdk
cd emsdk

# Install Emscripten SDK
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
cd ..

# Get vgmstream
git clone https://github.com/vgmstream/vgmstream
cd vgmstream

# Compile vgmstream
mkdir -p embuild
cd embuild
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
make
```
You can compile faster using `make -j 5` instead of the last `make` command (replace `5` with the number of cores your CPU has plus one), but please note that, with multiple jobs, in case any issues occur the output will become useless.

The output files `vgmstream-cli.wasm` and `vgmstream-cli.js` will be located in the `vgmstream/embuild/cli` directory.

The `source ./emsdk_env.sh` line will temporarily add Emscripten tools to PATH, which resets when the terminal is closed. If you use emsdk a lot, add this line to your `~/.bashrc`:
```sh
source "/path/to/emsdk/emsdk_env.sh" > /dev/null 2>&1; export PATH;
```

See also: [Build guide for vgmstream](https://github.com/vgmstream/vgmstream/blob/master/doc/BUILD.md).