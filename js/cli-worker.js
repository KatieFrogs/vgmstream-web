"use strict"

var wasmDir = "https://nightly.link/vgmstream/vgmstream/workflows/cmake-wasm/master/vgmstream-wasm.zip"
var wasmZip = true

function corsBridge(input){
	var url = new URL("https://api.allorigins.win/raw")
	url.searchParams.append("url", input)
	return fetch(url.toString())
}

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

function setupDir(dir, callback){
	var wfs = "/workerfs"
	FS.mkdir(wfs)
	FS.mount(WORKERFS, {
		files: dir
	}, wfs)
	FS.chdir(wfs)
	try{
		var output = callback()
	}finally{
		FS.chdir("/")
		FS.unmount(wfs)
		FS.rmdir(wfs)
	}
	return output
}

async function convertDir(dir, inputFilename){
	var outputFilename = "/output.wav"
	
	var output = setupDir(dir, () => vgmstream("-I", "-o", outputFilename, "-i", inputFilename))
	
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

function errorLoading(file){
	postMessage({
		subject: "load",
		error: "Error loading " + file
	})
}

async function loadCli(){
	var wasmBlobUrl
	if(wasmZip){
		var jsZip, vgmZip
		var promises = []
		promises.push(new Promise(async (resolve, reject) => {
			try{
				jsZip = await (await fetch("lib/jszip.min.js")).text()
			}catch(e){
				errorLoading("jszip.min.js")
				return reject()
			}
			resolve()
		}))
		promises.push(new Promise(async (resolve, reject) => {
			try{
				vgmZip = await (await corsBridge(wasmDir)).blob()
			}catch(e){
				errorLoading("vgmstream-wasm.zip")
				return reject()
			}
			resolve()
		}))
		await Promise.all(promises)
		eval.bind()(jsZip)
		var zip = new JSZip()
		try{
			var zipContent = await zip.loadAsync(vgmZip)
		}catch(e){
			return errorLoading("vgmstream-wasm.zip")
		}
		var wasmBlob = new Blob([
			await zip.file("vgmstream-cli.wasm").async("arraybuffer")
		], {
			type: "application/wasm"
		})
		wasmBlobUrl = URL.createObjectURL(wasmBlob)
		wasmUri = name => wasmBlobUrl
		var cliJs = await zip.file("vgmstream-cli.js").async("string")
		eval.bind()(cliJs)
	}else{
		wasmUri = name => wasmDir + name
		try{
			var cliJs = await (await fetch(wasmDir + "vgmstream-cli.js")).text()
		}catch(e){
			return errorLoading("vgmstream-cli.js")
		}
	}
	eval.bind()(cliJs)
	await new Promise(resolve => {
		Module["onRuntimeInitialized"] = resolve
	})
	if(wasmBlobUrl){
		URL.revokeObjectURL(wasmBlobUrl)
	}
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

var wasmUri
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
	noInitialRun: true,
	locateFile: name => wasmUri(name)
}
addEventListener("message", event => messageEvent(event.data))
loadCli()
