class DarkToggle{
	constructor(){
		this.toggles = new Set()
		this.resets = new Set()
		this.autoLocked = false
		
		var mediaStyles = document.querySelectorAll("link[rel='stylesheet'][media]")
		this.styles = new Set()
		for(var i = 0; i < mediaStyles.length; i++){
			if(mediaStyles[i].media.startsWith("(prefers-color-scheme:")){
				this.styles.add(mediaStyles[i])
			}
		}
		
		this.colorscheme = document.createElement("meta")
		this.colorscheme.name = "color-scheme"
		document.head.appendChild(this.colorscheme)
		
		this.media = matchMedia("(prefers-color-scheme: dark)")
		this.media.addEventListener("change", () => {
			this.changeTheme(this.media.matches, true)
		})
		
		var storage = localStorage.vgmPlayerTheme
		if(storage === "dark" || storage === "light"){
			this.autoLocked = true
			this.changeTheme(storage === "dark")
		}else{
			this.changeTheme(this.media.matches)
		}
	}
	addToggle(toggle){
		this.toggles.add(toggle)
		toggle.textContent = this.dark ? "Light theme" : "Dark theme"
		this.linkClick(toggle, this.toggleTheme.bind(this))
	}
	addReset(reset){
		this.resets.add(reset)
		reset.style.display = this.autoLocked ? "inline" : ""
		this.linkClick(reset, this.resetTheme.bind(this))
	}
	linkClick(link, callback){
		link.addEventListener("click", callback)
		link.addEventListener("keypress", event => {
			if(event.key === "Enter"){
				callback()
			}
		})
	}
	changeTheme(dark, auto){
		if(auto && this.autoLocked){
			return
		}
		this.dark = dark
		this.colorscheme.content = dark ? "dark" : "light"
		this.styles.forEach(style => {
			style.media = dark ? "all" : "not all"
			style.disabled = !dark
		})
		this.toggles.forEach(toggle => {
			toggle.textContent = this.dark ? "Light theme" : "Dark theme"
		})
		this.resets.forEach(reset => {
			reset.style.display = this.autoLocked ? "inline" : ""
		})
	}
	toggleTheme(){
		this.autoLocked = true
		this.changeTheme(!this.dark)
		localStorage.vgmPlayerTheme = this.dark ? "dark" : "light"
	}
	resetTheme(){
		this.autoLocked = false
		this.changeTheme(this.media.matches)
		localStorage.removeItem("vgmPlayerTheme")
	}
}
function addToggles(){
	darkToggle.addToggle(document.getElementById("darktoggle"))
	darkToggle.addReset(document.getElementById("darkreset"))
}
var darkToggle = new DarkToggle()
if(document.readyState === "loading"){
	document.addEventListener("DOMContentLoaded", addToggles)
}else{
	addToggles()
}
