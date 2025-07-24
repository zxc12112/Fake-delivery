const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static("public"));

const parcels = {};

function generateTrackingNumber() {
  const prefix = "PE";
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = prefix;
  for (let i = 0; i < 9; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

app.post("/api/create", (req, res) => {
  const id = generateTrackingNumber();
  parcels[id] = {
    trackingNumber: id,
    statusHistory: [],
    proofPhotos: [],
    labelData: req.body.labelData || {},
  };
  res.json({ trackingNumber: id });
});

app.post("/api/updateStatus", (req, res) => {
  const { trackingNumber, status } = req.body;
  if (!parcels[trackingNumber]) return res.status(404).json({ error: "Not found" });
  parcels[trackingNumber].statusHistory.push({
    status,
    timestamp: new Date().toISOString(),
  });
  res.json({ success: true });
});

app.post("/api/uploadPhoto", (req, res) => {
  if (!req.files || !req.files.photo) {
    return res.status(400).json({ error: "No photo uploaded" });
  }
  const photo = req.files.photo;
  const trackingNumber = req.body.trackingNumber;
  if (!parcels[trackingNumber]) return res.status(404).json({ error: "Not found" });

  const uploadPath = path.join(__dirname, "public", "uploads", `${Date.now()}-${photo.name}`);
  photo.mv(uploadPath, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    parcels[trackingNumber].proofPhotos.push(`/uploads/${path.basename(uploadPath)}`);
    res.json({ success: true, url: `/uploads/${path.basename(uploadPath)}` });
  });
});

app.get("/api/parcel/:trackingNumber", (req, res) => {
  const { trackingNumber } = req.params;
  if (!parcels[trackingNumber]) return res.status(404).json({ error: "Not found" });
  res.json(parcels[trackingNumber]);
});

app.get("/label/:trackingNumber", (req, res) => {
  const { trackingNumber } = req.params;
  if (!parcels[trackingNumber]) return res.status(404).send("Label not found");

  const labelData = parcels[trackingNumber].labelData || {};
  res.send(`
    <html>
      <head>
        <title>Parcel Express Label</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .label { border: 2px solid black; width: 400px; padding: 20px; }
          .header { font-weight: bold; font-size: 24px; margin-bottom: 10px; }
          .barcode { margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">Parcel Express</div>
          <div>Tracking Number: <strong>${trackingNumber}</strong></div>
          <div>Sender: ${labelData.sender || "N/A"}</div>
          <div>Receiver: ${labelData.receiver || "N/A"}</div>
          <div>Weight: ${labelData.weight || "N/A"}</div>
          <div class="barcode">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${trackingNumber}" alt="Barcode" />
          </div>
        </div>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Parcel Express app listening on port ${PORT}`));