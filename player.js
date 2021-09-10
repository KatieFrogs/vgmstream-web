var input = document.getElementById("input")
var selectbtn = document.getElementById("selectbtn")
var audiobox = document.getElementById("audiobox")
var filenamebox = document.getElementById("filenamebox")
var audio = document.getElementById("audio")
var download = document.getElementById("download")
var log = document.getElementById("log")
var fadeoverlay = document.getElementById("fadeoverlay")
var dlfilename

class WorkerWrapper{
	constructor(url){
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
	send(subject, content){
		return this.load().then(() => {
			return new Promise((resolve, reject) => {
				this.on(subject).then(resolve, reject)
				return this.worker.postMessage({
					subject: subject,
					content: content
				})
			})
		})
	}
	messageEvent(data){
		var addedType = this.allEvents.get(data.subject)
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
var cliWorker = new WorkerWrapper("cli-worker.js")

async function convertFile(file){
	fade(1, true)
	try{
		var response = await cliWorker.send("convertFile", file)
	}finally{
		fade(0)
	}
	return response
}

function insertAudio(response){
	if(response.error){
		if(response.error.type === "wasm"){
			alert("The WebAssembly application crashed while decoding this file")
		}else{
			alert("Could not convert file: " + response.stderr.trim())
		}
	}else if(response.url){
		if(audio.src){
			URL.revokeObjectURL(audio.src)
		}
		audio.src = response.url
		dlfilename = response.outputFilename
		filenamebox.innerText = response.inputFilename
		var logMessage = (response.stdout.trim() + "\n" + response.stderr.trim()).trim()
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
		fadeoverlay.style.pointerEvents = "auto"
		fadeoverlay.style.color = "#fff"
	}else{
		fadeoverlay.style.pointerEvents = ""
		fadeoverlay.style.color = ""
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
document.addEventListener("drop", event => {
	fade(0)
	event.preventDefault()
	var file = event.dataTransfer.files[0]
	if(file){
		convertFile(file).then(insertAudio)
	}
})
input.addEventListener("change", event => {
	var file = input.files[0]
	if(file){
		convertFile(file).then(insertAudio)
	}
})
selectbtn.addEventListener("click", event => {
	input.click()
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
