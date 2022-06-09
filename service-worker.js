var version = "v22.06.09"
var wasmVersion = "wasm"

var urls = [
	"./",
	"css/custom-audio.css",
	"css/player-dark.css",
	"css/player.css",
	"img/favicon.png",
	"index.html",
	"js/cli-worker.js",
	"js/custom-audio.js",
	"js/dark-toggle.js",
	"js/lib/jszip.min.js",
	"js/player.js",
	"js/soundbuffer.js"
]

var wasmDir = corsBridge("https://nightly.link/vgmstream/vgmstream/workflows/cmake-wasm/master/vgmstream-wasm.zip")
var wasmExpire = 1000 * 60 * 60 * 24

function corsBridge(input){
	var url = new URL("https://api.allorigins.win/raw")
	url.searchParams.append("url", input)
	return url.toString()
}

async function workerInstall(){
	var cache = await caches.open(version)
	await cache.addAll(urls)
	await self.skipWaiting()
}
self.addEventListener("install", event => {
	event.waitUntil(workerInstall())
})

async function workerActivate(){
	await deleteOldCaches()
	await self.clients.claim()
}
async function deleteOldCaches(){
	var currentCaches = [version, wasmVersion]
	var promises = []
	var cacheKeys = await caches.keys()
	cacheKeys.forEach(cache => {
		if(currentCaches.indexOf(cache) === -1){
			promises.push(caches.delete(cache))
		}
	})
	await Promise.all(promises)
}
self.addEventListener("activate", event => {
	event.waitUntil(workerActivate())
})

async function workerFetch(event){
	var request = event.request
	var isWasmDir = request.url === wasmDir
	var cachedResponse = await caches.match(request)
	var recent = true
	if(cachedResponse){
		if(!isWasmDir){
			return cachedResponse
		}else{
			recent = isRecent(cachedResponse)
			if(recent){
				return cachedResponse
			}
		}
	}
	var opt = {}
	if(isWasmDir && !recent){
		opt.cache = "reload"
	}
	var response = await fetch(request, opt)
	var copy = response.clone()
	if(isWasmDir){
		event.waitUntil(addTimestamp(request, copy))
	}else{
		var cache = await caches.open(version)
		cache.put(request, copy)
	}
	return response
}
function isRecent(response){
	if(!self.navigator.onLine){
		return true
	}else if(response){
		var timestamp = response.headers.get("worker-timestamp")
		return timestamp && Date.now() - wasmExpire < parseInt(timestamp)
	}
	return false
}
async function addTimestamp(request, copy){
	var headers = new Headers(copy.headers)
	headers.append("worker-timestamp", Date.now().toString())
	var blob = await copy.blob()
	var cache = await caches.open(wasmVersion)
	cache.put(request, new Response(blob, {
		status: copy.status,
		statusText: copy.statusText,
		headers: headers
	}))
}
self.addEventListener("fetch", event => {
	var request = event.request
	if(request.url.startsWith(self.location.origin + "/") || request.url === wasmDir){
		event.respondWith(workerFetch(event))
	}
})
