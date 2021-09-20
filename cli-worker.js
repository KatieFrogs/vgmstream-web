async function messageEvent(data){
	var input = data.content
	var output
	var error
	try{
		switch(data.subject){
			case "convertFile":
				output = await convertFile(...input)
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

async function convertFile(file){
	var inputFilename = file.name
	var outputFilename = inputFilename + ".wav"
	var data = new Uint8Array(await file.arrayBuffer())
	writeFile(inputFilename, data)
	stdoutBuffer = ""
	stderrBuffer = ""
	var output = vgmstream("-i", inputFilename)
	deleteFile(inputFilename)
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
	output.outputFilename = outputFilename
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
		stdout: stdoutCopy(),
		stderr: stderrCopy()
	}
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
	for(var i in error){
		if(typeof error[i] === "function"){
			delete error[i]
		}
	}
}

function stdoutCopy(){
	var stdout = stdoutBuffer
	stdoutBuffer = ""
	return stdout
}

function stderrCopy(){
	var stderr = stderrBuffer
	stderrBuffer = ""
	return stderr
}

var stdoutBuffer = ""
var stderrBuffer = ""
var Module = {
	preRun: () => {
		FS.init(undefined, code => {
			stdoutBuffer += String.fromCharCode(code)
		}, code => {
			stderrBuffer += String.fromCharCode(code)
		})
	},
	noInitialRun: true
}
addEventListener("message", event => messageEvent(event.data))
loadCli()
