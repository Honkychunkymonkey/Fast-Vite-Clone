const ws = new WebSocket(`wss://${window.location.hostname}/hmr`);

ws.addEventListener("open", () => {
  console.log("WebSocket is open now.");
});

ws.addEventListener("message", (event) => {
  if (event.data === "reload") {
    window.location.reload();
  }
});

ws.addEventListener("error", (error) => {
  console.log("WebSocket Error: ", error);
});
console.log("hmr-client.js loaded");
ws.addEventListener("close", (event) => {
  console.log("WebSocket closed: ", event);
});
