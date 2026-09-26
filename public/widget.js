// InterCall embed: <script src="https://your-intercall-host/widget.js" async></script>
// Adds a launcher button and loads the chat in an iframe from the same host.
;(function () {
  if (window.__intercall) return
  window.__intercall = true
  var origin = new URL(document.currentScript.src).origin

  var frame = document.createElement("iframe")
  frame.src = origin + "/embed"
  frame.title = "Chat with support"
  frame.allow = "clipboard-write; microphone; autoplay"
  frame.style.cssText =
    "transition:width .3s,height .3s;position:fixed;right:24px;bottom:100px;width:min(400px,calc(100vw - 32px));height:min(640px,calc(100vh - 130px));border:1px solid rgba(0,0,0,.1);box-shadow:0 24px 60px -12px rgba(0,0,0,.35);z-index:2147483000;display:none;background:#fff"

  // Dims the page while the chat is expanded; clicking it shrinks the chat.
  var backdrop = document.createElement("div")
  backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2147482999;display:none"
  backdrop.onclick = function () { expand(false) }

  // The launcher: the InterCall walrus, cropped to its face.
  var btn = document.createElement("button")
  btn.setAttribute("aria-label", "Open chat")
  btn.style.cssText =
    "position:fixed;right:24px;bottom:24px;width:64px;height:64px;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.9);overflow:hidden;cursor:pointer;z-index:2147483000;color:#fff;font:600 22px/1 system-ui,sans-serif;background:radial-gradient(circle at 50% 35%,#2b4fd8,#0b1020 70%);box-shadow:0 10px 30px -6px rgba(43,79,216,.6);transition:transform .2s"
  var face = document.createElement("img")
  face.src = origin + "/walrus-hero.avif"
  face.alt = ""
  face.style.cssText = "width:100%;height:100%;object-fit:cover;object-position:50% 0;transform:scale(1.2);transform-origin:50% 32%;display:block;pointer-events:none"
  var closeMark = document.createElement("span")
  closeMark.textContent = "✕"
  closeMark.style.cssText = "position:absolute;inset:0;display:none;place-items:center;background:rgba(0,0,0,.5)"
  btn.appendChild(face)
  btn.appendChild(closeMark)
  btn.onmouseenter = function () { btn.style.transform = "scale(1.08)" }
  btn.onmouseleave = function () { btn.style.transform = "" }

  function toggle(open) {
    frame.style.display = open ? "block" : "none"
    closeMark.style.display = open ? "grid" : "none"
    if (!open) expand(false)
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat")
  }
  btn.onclick = function () { toggle(frame.style.display === "none") }
  // Expanded: larger and centered on the page. Otherwise: docked bottom right.
  var docked = { right: "24px", bottom: "100px", top: "auto", left: "auto", margin: "0", width: frame.style.width, height: frame.style.height }
  var centered = { right: "0", bottom: "0", top: "0", left: "0", margin: "auto", width: "min(1080px,calc(100vw - 32px))", height: "min(860px,calc(100vh - 48px))" }
  function expand(big) {
    var s = big ? centered : docked
    for (var k in s) frame.style[k] = s[k]
    backdrop.style.display = big ? "block" : "none"
  }
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data) return
    if (e.data.intercall === "close") toggle(false)
    if (e.data.intercall === "expand") expand(!!e.data.value)
  })

  document.body.appendChild(backdrop)
  document.body.appendChild(frame)
  document.body.appendChild(btn)
})()
