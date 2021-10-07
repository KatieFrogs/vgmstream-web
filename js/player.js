var browse = document.getElementById("browse")
var browsedir = document.getElementById("browsedir")
var selectbtn = document.getElementById("selectbtn")
var selectdirbtn = document.getElementById("selectdirbtn")
var directorybox = document.getElementById("directorybox")
var dirselect = document.getElementById("dirselect")
var audiobox = document.getElementById("audiobox")
var filenamebox = document.getElementById("filenamebox")
var audio = document.getElementById("audio")
var download = document.getElementById("download")
var log = document.getElementById("log")
var fadeoverlay = document.getElementById("fadeoverlay")

var jsDir = "js/"
var dlfilename
var noConverting
var dirPromise

var canPickDir = (typeof showDirectoryPicker === "function" || "webkitdirectory" in HTMLInputElement.prototype) && !(/Android|iPhone|iPad/.test(navigator.userAgent))
if(canPickDir){
	selectdirbtn.style.display = "block"
}

class WorkerWrapper{
	constructor(url){
		this.symbol = 0
		this.allEvents = new Map()
		this.worker = new Worker(url)
		this.worker.addEventListener("message", event => this.messageEvent(event.data))
		this.worker.addEventListener("error", event => this.messageEvent({
			subject: "load",
			error: "Error loading " + url
		}))
		this.on("load").then(() => {
			this.loaded = true
		}, error => {
			alert(error)
		})
	}
	send(subject, ...content){
		return this.load().then(() => {
			return new Promise((resolve, reject) => {
				var symbol = ++this.symbol
				this.on(symbol).then(resolve, reject)
				return this.worker.postMessage({
					symbol: symbol,
					subject: subject,
					content: content
				})
			})
		})
	}
	messageEvent(data){
		var addedType = this.allEvents.get(data.symbol || data.subject)
		if(addedType){
			addedType.forEach(callback => {
				if(data.error){
					callback.reject(data.error)
				}else{
					callback.resolve(data.content)
				}
			})
			this.allEvents.delete(data.subject)
		}
	}
	load(){
		if(this.loaded){
			return Promise.resolve(this.worker)
		}else if(this.loadError){
			return Promise.reject()
		}else{
			return this.on("load")
		}
	}
	on(type){
		return new Promise((resolve, reject) => {
			var addedType = this.allEvents.get(type)
			if(!addedType){
				addedType = new Set()
				this.allEvents.set(type, addedType)
			}
			addedType.add({
				resolve: resolve,
				reject: reject
			})
		})
	}
}
var cliWorker = new WorkerWrapper(jsDir + "cli-worker.js")

function vgmstream(...args){
	return cliWorker.send("vgmstream", ...args)
}

function writeFile(name, data){
	return cliWorker.send("writeFile", name, data)
}

function readFile(name){
	return cliWorker.send("readFile", name)
}

function deleteFile(name){
	return cliWorker.send("deleteFile", name)
}

function convertFile(file){
	return convertDir([file], file.name)
}

async function convertDir(files, inputFilename){
	fade(1, true)
	try{
		var response = await cliWorker.send("convertDir", files, inputFilename)
	}finally{
		fade(0)
	}
	return response
}

function insertAudio(response){
	var wfs = "/workerfs/"
	if(!response || response.error){
		if(!response){
			throw new Error()
		}else if(response.error.type === "wasm"){
			alert("The WebAssembly application crashed while decoding this file")
		}else if(response.stderr){
			alert("Could not convert file: " + response.stderr.replaceAll(wfs, "").trim())
		}else{
			throw new Error(response.error)
		}
	}else if(response.url){
		if(audio.src){
			URL.revokeObjectURL(audio.src)
		}
		audio.src = response.url
		var sampleRate = response.stdout.match(/sample rate: (\d+) Hz/)
		var startSamples = response.stdout.match(/loop start: (\d+) samples/)
		var endSamples = response.stdout.match(/loop end: (\d+) samples/)
		audio.loop = false
		if(sampleRate && startSamples){
			var hz = parseFloat(sampleRate[1])
			if(hz > 0){
				audio.loop = true
				audio.loopStart = (startSamples[1] || 0) / hz
				if(endSamples){
					audio.loopEnd = (endSamples[1] || 0) / hz
				}
			}
		}
		dlfilename = response.outputFilename
		filenamebox.innerText = response.inputFilename
		var stdout = response.stdout.replaceAll(wfs, "").trim()
		var stderr = response.stderr.replaceAll(wfs, "").trim()
		var logMessage = (stdout + "\n" + stderr).trim()
		logTable(log, logMessage)
		audiobox.style.display = "block"
	}
}

function logTable(log, logMessage){
	var tableRegex = /(?:.+?: .*?(?:\n|$))+/g
	var index = 0
	log.innerText = ""
	while((matches = tableRegex.exec(logMessage)) !== null){
		if(matches.index === tableRegex.lastIndex){
			tableRegex.lastIndex++
		}
		if(index < matches.index){
			var div = document.createElement("div")
			div.innerText = logMessage.slice(index, matches.index)
			log.appendChild(div)
		}
		var table = document.createElement("table")
		matches.forEach(match => {
			match.split("\n").forEach(line => {
				if(line){
					var colon = line.indexOf(": ")
					var tr = document.createElement("tr")
					var th = document.createElement("th")
					th.innerText = colon !== -1 ? line.slice(0, colon + 1) : ""
					tr.appendChild(th)
					var td = document.createElement("td")
					td.innerText = colon !== -1 ? line.slice(colon + 2) : line
					tr.appendChild(td)
					table.appendChild(tr)
				}
			})
		})
		log.appendChild(table)
		index = tableRegex.lastIndex
	}
}

function fade(opacity, modal){
	fadeoverlay.style.opacity = opacity
	if(modal){
		fadeoverlay.classList.add("modal")
	}else{
		fadeoverlay.classList.remove("modal")
	}
}

async function walkEntry(entry, path="", output=[]){
	await new Promise(async resolve => {
		if(entry.isFile){
			entry.file(file => {
				output.push(new File([file], path + file.name))
				return resolve()
			}, resolve)
		}else if(entry.isDirectory){
			var dirReader = entry.createReader()
			dirReader.readEntries(async entries => {
				var dirPromises = []
				for(var i = 0; i < entries.length; i++){
					dirPromises.push(walkEntry(entries[i], path + entry.name + "/", output))
				}
				await Promise.all(dirPromises)
				return resolve()
			}, resolve)
		}else{
			return resolve()
		}
	})
	return output
}

async function walkFilesystem(file, top, path="", output=[]){
	await filePermission(file)
	if(file.kind === "directory"){
		for await(let subfile of file.values()){
			await walkFilesystem(subfile, false, top ? "" : path + file.name + "/", output)
		}
	}else{
		output.push(new File([await file.getFile()], path + file.name))
	}
	return output
}

async function filePermission(file){
	if(await file.queryPermission() !== "granted"){
		if(await file.requestPermission() !== "granted"){
			throw new Error("File permission denied")
		}
	}
}

async function displayFiles(files){
	var inputFilename = await selectFile(files)
	if(inputFilename){
		insertAudio(await convertDir(files, inputFilename))
	}
}

async function selectFile(files){
	if(files.length === 0){
		return
	}else if(files.length === 1){
		return files[0].name
	}
	
	var audioStyle = audiobox.style.display
	audiobox.style.display = ""
	directorybox.style.display = "block"
	dirselect.innerText = ""
	
	var dir = []
	for(var i = 0; i < files.length; i++){
		dir.push(files[i])
	}
	dir = dir.map(file => file.name).sort()
	dir.forEach(name => {
		var option = document.createElement("option")
		option.value = name
		option.innerText = name
		dirselect.appendChild(option)
	})
	dirselect.size = Math.max(2, Math.min(20, dir.length))
	dirselect.focus()
	
	var fileSelected
	var file = await new Promise(resolve => {
		dirPromise = resolve
		fileSelected = event => {
			if(event.type = "submit"){
				event.preventDefault()
			}
			if(dirselect.value){
				resolve(dirselect.value)
			}
		}
		dirselect.form.addEventListener("submit", fileSelected)
		dirselect.addEventListener("dblclick", fileSelected)
	})
	
	dirPromise = null
	dirselect.form.removeEventListener("submit", fileSelected)
	dirselect.removeEventListener("dblclick", fileSelected)
	directorybox.style.display = ""
	audiobox.style.display = audioStyle
	
	if(file){
		return file
	}
}

function cleanup(){
	audio.pause()
	if(dirPromise){
		dirPromise()
	}
}

document.addEventListener("dragover", event => {
	event.preventDefault()
	event.dataTransfer.dropEffect = "copy"
	fade(0.5)
})
document.addEventListener("dragleave", () => {
	fade(0)
})
document.addEventListener("drop", async event => {
	cleanup()
	fade(0)
	event.preventDefault()
	var items = event.dataTransfer.items
	if(!noConverting){
		var fileSystem = location.protocol === "https:" && DataTransferItem.prototype.getAsFileSystemHandle
		var files = []
		var dropPromises = []
		for(var i = 0; i < items.length; i++){
			let promise
			if(this.fileSystem){
				promise = item.getAsFileSystemHandle().then(file => walkFilesystem(file))
			}else{
				var entry = items[i].webkitGetAsEntry()
				if(entry){
					promise = walkEntry(entry)
				}
			}
			if(promise){
				dropPromises.push(promise.then(filelist => {
					files = files.concat(filelist)
				}))
			}
		}
		await Promise.all(dropPromises)
		displayFiles(files)
	}
})
browse.addEventListener("change", async event => {
	cleanup()
	var files = browse.files
	if(!noConverting){
		displayFiles(files)
	}
})
browsedir.addEventListener("change", async event => {
	cleanup()
	if(!noConverting){
		var files = []
		for(var i = 0; i < browsedir.files.length; i++){
			var file = browsedir.files[i]
			var path = file.webkitRelativePath
			var index = path.indexOf("/")
			if(index !== -1){
				path = path.slice(index + 1)
			}
			files.push(new File([file], path))
		}
		displayFiles(files)
	}
})
selectbtn.addEventListener("click", event => {
	browse.click()
})
selectdirbtn.addEventListener("click", async event => {
	if(typeof showDirectoryPicker === "function"){
		try{
			var file = await showDirectoryPicker()
		}catch(e){
			return
		}
		cleanup()
		if(!noConverting){
			var files = await walkFilesystem(file, true)
			displayFiles(files)
		}
	}else{
		browsedir.click()
	}
})
download.addEventListener("click", event => {
	var link = document.createElement("a")
	link.href = audio.src
	if("download" in HTMLAnchorElement.prototype){
		link.download = dlfilename
	}else{
		link.target = "_blank"
	}
	link.innerText = "."
	link.style.opacity = "0"
	document.body.appendChild(link)
	setTimeout(() => {
		link.click()
		document.body.removeChild(link)
	})
})
