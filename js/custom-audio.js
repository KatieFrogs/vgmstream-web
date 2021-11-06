"use strict"

var buffer = new SoundBuffer()

class CustomAudio extends HTMLElement{
	#updateInterval = 200
	#seekStep = 0.1
	
	constructor(){
		super()
		this.attachShadow({mode: "open"})
		this.#addStyle()
	}
	async #addStyle(){
		var css = await (await fetch("css/custom-audio.css")).text()
		if(this.shadowRoot.adoptedStyleSheets){
			var style = new CSSStyleSheet()
			await style.replace(css)
			this.shadowRoot.adoptedStyleSheets = [style]
		}else{
			var style = document.createElement("style")
			style.appendChild(document.createTextNode(css))
			this.shadowRoot.append(style)
		}
	}
	#shown
	#loaded
	#player
	#playButton
	#onPlayBind
	#onKeyBind
	#onSeekBind
	#timestamp
	#seek
	#showPlayer(){
		this.#shown = true
		this.#onKeyBind = this.#onKey.bind(this)
		this.addEventListener("keydown", this.#onKeyBind)
		this.#player = document.createElement("div")
		this.#player.classList.add("player")
		if(this.#loaded){
			this.#player.classList.add("loaded")
		}
		this.#player.part = "player"
		this.#playButton = document.createElement("button")
		this.#playButton.classList.add("play")
		this.#onPlayBind = this.#onPlay.bind(this)
		this.#playButton.addEventListener("click", this.#onPlayBind)
		var xmlns = "http://www.w3.org/2000/svg"
		var svg = document.createElementNS(xmlns, "svg")
		svg.setAttributeNS(null, "width", "12")
		svg.setAttributeNS(null, "height", "12")
		var svgPlay = document.createElementNS(xmlns, "path")
		svgPlay.setAttributeNS(null, "d", "m3 0v12l9-6")
		svgPlay.classList.add("icon-play")
		svg.appendChild(svgPlay)
		var svgPause = document.createElementNS(xmlns, "path")
		svgPause.setAttributeNS(null, "d", "m1 0v12h3.5v-12m3 0v12h3.5v-12")
		svgPause.classList.add("icon-pause")
		svg.appendChild(svgPause)
		this.#playButton.appendChild(svg)
		this.#player.appendChild(this.#playButton)
		this.#timestamp = document.createElement("div")
		this.#timestamp.classList.add("timestamp")
		this.#player.appendChild(this.#timestamp)
		this.#seek = document.createElement("input")
		this.#seek.type = "range"
		this.#seek.min = "0"
		this.#seek.step = this.#seekStep
		this.#seek.classList.add("seek")
		this.#onSeekBind = this.#onSeek.bind(this)
		this.#seek.addEventListener("input", this.#onSeekBind)
		this.#player.appendChild(this.#seek)
		this.shadowRoot.append(this.#player)
		this.#update(true)
	}
	#hidePlayer(){
		this.#shown = false
		this.removeEventListener("keydown", this.#onKeyBind)
		this.#playButton.removeEventListener("click", this.#onPlayBind)
		this.#seek.removeEventListener("input", this.#onSeekBind)
		this.shadowRoot.removeChild(this.#player)
		this.#player = null
		this.#playButton = null
		this.#timestamp = null
		this.#seek = null
	}
	connectedCallback(){
		["controls", "loop", "src", "loopStart", "loopEnd"].forEach(prop => {
			this.#upgradeProperty(prop)
		})
		if(!this.hasAttribute("tabindex")){
			this.setAttribute("tabindex", 0)
		}
		if(this.controls && !this.#shown){
			this.#showPlayer()
		}
		if(!this.paused){
			this.#updateTimer = setInterval(this.#update.bind(this), 200)
		}
	}
	disconnectedCallback(){
		if(this.#shown){
			this.#hidePlayer()
		}
		clearInterval(this.#updateTimer)
	}
	static get observedAttributes(){
		return ["controls", "loop", "src", "loop-start", "loop-end"]
	}
	#gain = buffer.createGain()
	#sound
	#loopStart = 0
	#loopEnd = 0
	async attributeChangedCallback(name, oldValue, newValue){
		switch(name){
			case "controls":
				if(this.isConnected){
					if(newValue === null){
						if(this.#shown){
							this.#hidePlayer()
						}
					}else if(!this.#shown){
						this.#showPlayer()
					}
				}
				break
			case "loop":
				if(!this.paused){
					this.play()
				}
				break
			case "src":
					this.#loaded = false
					if(this.#shown){
						this.#player.classList.remove("loaded")
					}
					this.#event("loadstart")
					var opts = {}
					if(this.getAttribute("crossorigin") === "use-credentials"){
						opts.credentials = "include"
					}
					try{
						var sound = await this.#gain.load(await fetch(newValue, opts))
					}catch(e){
						this.#event("error")
						throw e
					}
					if(this.src !== newValue){
						return
					}
					this.#sound = sound
					this.#currentTime = 0
					if(this.paused){
						this.#update()
					}else{
						this.play()
					}
					this.#loaded = true
					if(this.#shown){
						this.#player.classList.add("loaded")
					}
					this.#event("progress")
					this.#event("canplay")
					this.#event("canplaythrough")
					this.#event("durationchange")
				break
			case "loop-start":
				this.#loopStart = this.#unformatTime(newValue)
				if(!this.paused){
					this.play()
				}
				break
			case "loop-end":
				this.#loopEnd = this.#unformatTime(newValue)
				if(!this.paused){
					this.play()
				}
				break
		}
	}
	#upgradeProperty(prop){
		if(this.hasOwnProperty(prop)){
			var value = this[prop]
			delete this[prop]
			this[prop] = value
		}
	}
	set controls(value){
		if(value){
			this.setAttribute("controls", "")
		}else{
			this.removeAttribute("controls")
		}
	}
	get controls(){
		return this.hasAttribute("controls")
	}
	set loop(value){
		if(value){
			this.setAttribute("loop", "")
		}else{
			this.removeAttribute("loop")
		}
	}
	get loop(){
		return this.hasAttribute("loop")
	}
	set src(value){
		this.setAttribute("src", value)
	}
	get src(){
		return this.getAttribute("src")
	}
	set loopStart(value){
		this.#loopStart = value
	}
	get loopStart(){
		return this.#loopStart
	}
	set loopEnd(value){
		this.#loopEnd = value
	}
	get loopEnd(){
		return this.#loopEnd
	}
	#currentTime = 0
	get currentTime(){
		var time = this.#currentTime
		if(!this.paused){
			time += this.#sound.getTime() - this.#soundStarted
		}
		if(this.loop){
			var start = this.#loopStart || 0
			var end = this.duration
			if(time > end){
				time = (time - start) % (start - end) + start
			}
		}else{
			time = Math.min(time, this.duration)
		}
		return time
	}
	set currentTime(value){
		if(!this.loop){
			value = Math.min(this.duration, value)
		}
		this.#currentTime = Math.max(0, value)
		if(this.paused){
			this.#update()
		}else{
			this.play()
		}
		this.#event("seeked")
	}
	get duration(){
		return this.loop && this.#loopEnd ? this.#loopEnd : (this.#sound ? this.#sound.duration : 0)
	}
	paused = true
	#update(full){
		if(this.#shown){
			this.#seek.max = this.duration.toFixed(1)
			this.#seek.value = this.currentTime.toFixed(1)
			var timestamp = this.#formatTime(this.currentTime, this.duration >= 60 * 60) + " / " + this.#formatTime(this.duration)
			if(this.#timestamp.innerText !== timestamp){
				this.#timestamp.innerText = timestamp
			}
			if(full){
				this.#playButton.classList[this.paused ? "add" : "remove"]("pause")
			}
			this.#event("timeupdate")
		}
	}
	#formatTime(seconds, forceHour){
		var minus = seconds < 0 ? "-" : ""
		seconds = Math.abs(seconds)
		var s = Math.floor(seconds % 60).toString().padStart(2, "0")
		var m = Math.floor(seconds / 60 % 60).toString()
		var h = Math.floor(seconds / 60 / 60)
		if(h || forceHour){
			return minus + h.toString() + ":" + m.padStart(2, "0") + ":" + s
		}
		return minus + m + ":" + s
	}
	#unformatTime(timestamp){
		var minus = 1
		if(timestamp.startsWith("-")){
			timestamp = timestamp.slice(1)
			minus = -1
		}
		var timeArray = timestamp.split(":")
		if(timeArray.length > 3){
			return 0
		}else if(timeArray.length === 3){
			var h = parseInt(timeArray[0]) || 0
			var m = parseInt(timeArray[1]) || 0
			var s = parseFloat(timeArray[2]) || 0
		}else if(timeArray.length === 2){
			var h = 0
			var m = parseInt(timeArray[0]) || 0
			var s = parseFloat(timeArray[1]) || 0
		}else if(timeArray.length === 1){
			var h = 0
			var m = 0
			var s = parseFloat(timeArray[0]) || 0
		}
		return minus * (h * 60 + m) * 60 + s
	}
	#onPlay(){
		if(this.paused){
			this.play()
		}else{
			this.pause()
		}
	}
	#updateTimer
	#soundStarted
	play(){
		if(!this.#sound){
			return
		}
		if(!this.paused){
			this.pause()
		}
		if(!this.loop && this.currentTime >= this.duration){
			this.#currentTime = 0
		}
		this.paused = false
		this.#soundStarted = this.#sound.getTime()
		if(this.loop){
			this.#sound.playLoop(0, false, this.currentTime, this.#loopStart, this.#loopEnd)
		}else{
			this.#sound.play(0, false, this.currentTime, 0, this.#onEnded.bind(this))
		}
		this.#update(true)
		this.#updateTimer = setInterval(this.#update.bind(this), this.#updateInterval)
		this.#event("play")
	}
	pause(){
		if(this.paused){
			return
		}
		this.paused = true
		this.#sound.stop()
		this.#currentTime += this.#sound.getTime() - this.#soundStarted
		this.#update(true)
		clearInterval(this.#updateTimer)
		
	}
	#onKey(event){
		if(event.defaultPrevented || !this.#loaded){
			return
		}
		var capture = false
		switch(event.key){
			case " ":
				this.#onPlay()
				capture = true
				break
			case "ArrowLeft":
			case "ArrowRight":
				this.currentTime += event.key === "ArrowLeft" ? -5 : 5
				capture = true
				break
			case "ArrowUp":
			case "ArrowDown":
				capture = true
				break
		}
		if(capture){
			event.preventDefault()
		}
	}
	#onSeek(event){
		this.currentTime = parseFloat(event.currentTarget.value)
	}
	#onEnded(){
		this.pause()
		this.#event("ended")
	}
	#event(name){
		this.dispatchEvent(new CustomEvent(name))
	}
}
customElements.define("custom-audio", CustomAudio)
