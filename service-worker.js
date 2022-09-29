var version = "v22.09.29"
var wasmVersion = "wasm2"
var shareTargetVersion = "share-target"

var urls = [
	"./",
	"css/custom-audio.css",
	"css/player-dark.css",
	"css/player.css",
	"img/apple-touch-icon.png",
	"img/favicon.png",
	"index.html",
	"js/cli-worker.js",
	"js/custom-audio.js",
	"js/dark-toggle.js",
	"js/player.js",
	"js/soundbuffer.js"
]

var wasmDir = "https://cdn.vgmstream.org/js/"
var wasmVer = wasmDir + "version"
var wasmUrls = [
	wasmVer,
	wasmDir + "vgmstream-cli.js",
	wasmDir + "vgmstream-cli.wasm"
]

async function workerInstall(){
	var cache = await caches.open(version)
	var wasmCache = await caches.open(wasmVersion)
	var promises = [
		cache.addAll(urls),
		wasmCache.addAll(wasmUrls)
	]
	await Promise.all(promises)
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
	var currentCaches = [version, wasmVersion, shareTargetVersion]
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
	var isWasmDir = request.url.startsWith(wasmDir)
	var isWasmVer = request.url === wasmVer
	var cachedResponse = await caches.match(request)
	var recent = true
	if(cachedResponse && (!isWasmVer || !self.navigator.onLine)){
		return cachedResponse
	}
	var opt = {}
	if(isWasmDir){
		opt.cache = "reload"
	}
	var response = await fetch(request, opt)
	var copy = response.clone()
	var cache = await caches.open(isWasmDir ? wasmVersion : version)
	if(isWasmVer){
		var priorCopy = await cache.match(request.url)
		if(priorCopy){
			var currentCopy = copy.clone()
			if(await priorCopy.text() !== await currentCopy.text()){
				await caches.delete(wasmVersion)
				cache = await caches.open(wasmVersion)
			}
		}
	}
	cache.put(request, copy)
	return response
}
async function shareTarget(event){
	var request = event.request
	var formData = await request.formData()
	var file = formData.get("file")
	var shareCache = await caches.open(shareTargetVersion)
	var headers = new Headers()
	headers.append("name", file.name)
	var response = new Response(file, {
		headers: headers
	})
	await shareCache.put("shared-file", response)
	var url = new URL(request.url)
	url.searchParams.delete("share-target")
	url.hash = "#share-target"
	return Response.redirect(url.toString(), 303)
}
self.addEventListener("fetch", event => {
	var request = event.request
	if(request.method === "POST" && request.url.endsWith("?share-target")){
		return event.respondWith(shareTarget(event))
	}else if(request.url.startsWith(self.location.origin + "/") || request.url.startsWith(wasmDir)){
		return event.respondWith(workerFetch(event))
	}
})
