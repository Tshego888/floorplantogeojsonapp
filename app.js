let imgElement = null;
let map, geoJsonLayer;
let geoJsonData = { type: "FeatureCollection", features: [] };
let uploadedImage = new Image();

document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedImage.onload = () => {
      
      if (map) map.remove();
      map = L.map("map", {
        crs: L.CRS.Simple,
        minZoom: -5
      });
      const bounds = [[0,0], [uploadedImage.height, uploadedImage.width]];
      L.imageOverlay(uploadedImage.src, bounds).addTo(map);
      map.fitBounds(bounds);
    };
    uploadedImage.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById("processBtn").addEventListener("click", () => {
  if (!uploadedImage.src) return alert("Upload an image first");
  if (typeof cv === "undefined") return alert("OpenCV not loaded yet");

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = uploadedImage.width;
  canvas.height = uploadedImage.height;
  ctx.drawImage(uploadedImage, 0, 0);

  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.threshold(gray, gray, 200, 255, cv.THRESH_BINARY);
  let edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  geoJsonData = { type: "FeatureCollection", features: [] };

  for (let i = 0; i < contours.size(); i++) {
    let cnt = contours.get(i);
    let area = cv.contourArea(cnt);
    if (area < 500) continue; 
    let approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 3, true);
    let coords = [];
    for (let j = 0; j < approx.rows; j++) {
      const point = approx.intPtr(j);
      coords.push([point[0], point[1]]);
    }
    if (coords.length >= 3) {
      geoJsonData.features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[...coords, coords[0]]] 
        },
        properties: { area }
      });
    }
    approx.delete();
  }

  src.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();

  if (geoJsonLayer) geoJsonLayer.remove();
  geoJsonLayer = L.geoJSON(geoJsonData, {
    style: { color: "red", weight: 2 }
  }).addTo(map);
  map.fitBounds(geoJsonLayer.getBounds());
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  if (!geoJsonData.features.length) return alert("No GeoJSON yet. Process first.");
  const blob = new Blob([JSON.stringify(geoJsonData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "floorplan.geojson";
  a.click();
  URL.revokeObjectURL(url);
});
