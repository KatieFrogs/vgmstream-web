async function messageEvent(data){
	var content = data.content
	var error
	try{
		switch(data.subject){
			case "convertFile":
				content = await convertFile(content)
				break
			default:
				error = new Error("Unknown message subject")
				break
		}
	}catch(e){
		error = e
	}
	return postMessage({
		symbol: data.symbol,
		subject: data.subject,
		error: error,
		content: content
	})
}

async function convertFile(file){
	var inputFilename = file.name
	var outputFilename = inputFilename + ".wav"
	var data = new Uint8Array(await file.arrayBuffer())
	var stream = FS.open(inputFilename, "w+")
	FS.write(stream, data, 0, data.length, 0)
	FS.close(stream)
	stdoutBuffer = ""
	stderrBuffer = ""
	try{
		callMain(["-i", inputFilename])
	}catch(e){
		return {
			error: {
				type: "wasm",
				stack: cleanError(e)
			},
			stdout: stdoutCopy(),
			stderr: stderrCopy()
		}
	}finally{
		FS.unlink(inputFilename)
	}
	try{
		var wav = FS.open(outputFilename, "r")
	}catch(e){
		return {
			error: {
				type: "unsupported",
				stack: cleanError(e)
			},
			stdout: stdoutCopy(),
			stderr: stderrCopy()
		}
	}
	var wavdata = new Uint8Array(wav.node.usedBytes)
	FS.read(wav, wavdata, 0, wav.node.usedBytes, 0)
	FS.close(wav)
	FS.unlink(outputFilename)
	return {
		inputFilename: inputFilename,
		outputFilename: outputFilename,
		url: URL.createObjectURL(new Blob([wavdata], {
			type: "audio/x-wav"
		})),
		stdout: stdoutCopy(),
		stderr: stderrCopy()
	}
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
