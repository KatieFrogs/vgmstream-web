async function messageEvent(data){
	var input = data.content
	var output
	var error
	try{
		switch(data.subject){
			case "convertDir":
				output = await convertDir(...input)
				break
			case "vgmstream":
				output = vgmstream(...input)
				break
			case "writeFile":
				output = writeFile(...input)
				break
			case "readFile":
				output = readFile(...input)
				break
			case "deleteFile":
				output = deleteFile(...input)
				break
			default:
				error = new Error("Unknown message subject")
				break
		}
	}catch(e){
		error = cleanError(e)
	}
	return postMessage({
		symbol: data.symbol,
		subject: data.subject,
		error: error,
		content: output
	})
}

async function convertDir(dir, inputFilename){
	var wfs = "/workerfs"
	var outputFilename = "/output.wav"
	FS.mkdir(wfs)
	FS.mount(WORKERFS, {
		files: dir
	}, wfs)
	var output = vgmstream("-o", outputFilename, "-i", wfs + "/" + inputFilename)
	FS.unmount(wfs)
	FS.rmdir(wfs)
	if(output.error){
		return output
	}
	var wavdata = readFile(outputFilename)
	if(!wavdata){
		output.error = {
			type: "unsupported"
		}
		return output
	}
	deleteFile(outputFilename)
	output.inputFilename = inputFilename
	output.outputFilename = inputFilename + ".wav"
	output.url = URL.createObjectURL(new Blob([wavdata], {
		type: "audio/x-wav"
	}))
	return output
}

function writeFile(name, data){
	var stream = FS.open(name, "w+")
	FS.write(stream, data, 0, data.length, 0)
	FS.close(stream)
}

function readFile(name){
	try{
		var file = FS.open(name, "r")
	}catch(e){
		return null
	}
	var data = new Uint8Array(file.node.usedBytes)
	FS.read(file, data, 0, file.node.usedBytes, 0)
	FS.close(file)
	return data
}

function deleteFile(name){
	try{
		FS.unlink(name)
	}catch(e){}
}

function vgmstream(...args){
	stdoutBuffer = ""
	stderrBuffer = ""
	var error
	try{
		callMain(args)
	}catch(e){
		error = {
			type: "wasm",
			stack: cleanError(e)
		}
	}
	var output = {
		stdout: stdoutBuffer,
		stderr: stderrBuffer
	}
	stdoutBuffer = ""
	stderrBuffer = ""
	if(error){
		output.error = error
	}
	return output
}

async function loadCli(){
	try{
		(0, eval)(await (await fetch("vgmstream-cli.js")).text())
	}catch(e){
		return postMessage({
			subject: "load",
			error: "Error loading vgmstream-cli.js"
		})
	}
	await new Promise(resolve => {
		Module["onRuntimeInitialized"] = resolve
	})
	return postMessage({
		subject: "load"
	})
}

function cleanError(error){
	var output = {}
	for(var i in error){
		if(typeof error[i] === "string"){
			output[i] = error[i]
		}
	}
	return output
}

var stdoutBuffer = ""
var stderrBuffer = ""
var Module = {
	preRun: () => {
		FS.init(undefined, code => {
			if(code !== null){
				stdoutBuffer += String.fromCharCode(code)
			}
		}, code => {
			if(code !== null){
				stderrBuffer += String.fromCharCode(code)
			}
		})
	},
	noInitialRun: true
}
addEventListener("message", event => messageEvent(event.data))
loadCli()
