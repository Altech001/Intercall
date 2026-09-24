// InterCall embed: <script src="https://your-intercall-host/widget.js" async></script>
// Adds a launcher button and loads the chat in an iframe from the same host.
;(function () {
  if (window.__intercall) return
  window.__intercall = true
  var origin = new URL(document.currentScript.src).origin

  var frame = document.createElement("iframe")
  frame.src = origin + "/embed"
  frame.title = "Chat with support"
  frame.allow = "clipboard-write"
  frame.style.cssText =
    "transition:width .3s,height .3s;position:fixed;right:24px;bottom:100px;width:min(400px,calc(100vw - 32px));height:min(640px,calc(100vh - 130px));border:1px solid rgba(0,0,0,.1);box-shadow:0 24px 60px -12px rgba(0,0,0,.35);z-index:2147483000;display:none;background:#fff"

  var btn = document.createElement("button")
  btn.setAttribute("aria-label", "Open chat")
  btn.textContent = "CHAT"
  btn.style.cssText =
    "position:fixed;right:24px;bottom:24px;width:64px;height:64px;border-radius:50%;border:0;cursor:pointer;z-index:2147483000;color:#fff;font:700 10px/1 system-ui,sans-serif;letter-spacing:.12em;background:conic-gradient(from 210deg,#d85fc8,#8a5cf0,#6b9be6,#79cfe0,#d85fc8);box-shadow:0 8px 30px -6px rgba(140,80,220,.6);transition:transform .2s"
  btn.onmouseenter = function () { btn.style.transform = "scale(1.08)" }
  btn.onmouseleave = function () { btn.style.transform = "" }

  function toggle(open) {
    frame.style.display = open ? "block" : "none"
    btn.textContent = open ? "✕" : "CHAT"
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat")
  }
  btn.onclick = function () { toggle(frame.style.display === "none") }
  var small = frame.style.width, smallH = frame.style.height
  function expand(big) {
    frame.style.width = big ? "min(760px,calc(100vw - 32px))" : small
    frame.style.height = big ? "calc(100vh - 120px)" : smallH
  }
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data) return
    if (e.data.intercall === "close") toggle(false)
    if (e.data.intercall === "expand") expand(!!e.data.value)
  })

  document.body.appendChild(frame)
  document.body.appendChild(btn)
})()
