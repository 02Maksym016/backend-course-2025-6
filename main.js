import { Command } from "commander";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import cors from "cors";


const program = new Command();

program
  .requiredOption("-h, --host <host>", "Server host")
  .requiredOption("-p, --port <port>", "Server port")
  .requiredOption("-c, --cache <cachePath>", "Cache directory path");

program.parse(process.argv);

const { host, port, cache: cacheDir } = program.opts();




if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

//   Data storage

const DATA_FILE = "data.json";
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Helpers
const loadData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

//   Express setup

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


//   Multer for photos

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, cacheDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 9999);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });


//   Serve HTML forms

app.get("/RegisterForm", (req, res) => {
  res.sendFile(path.resolve("RegisterForm.html"));
});

app.get("/SearchForm", (req, res) => {
  res.sendFile(path.resolve("SearchForm.html"));
});


//   POST /register

app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const items = loadData();
  const newItem = {
    id: Date.now().toString(),
    name: inventory_name,
    description: description || "",
    photo: req.file ? req.file.filename : null,
  };

  items.push(newItem);
  saveData(items);

  res.status(201).json(newItem);
});


//   GET /inventory

app.get("/inventory", (req, res) => {
  const items = loadData();
  const result = items.map((x) => ({
    ...x,
    photo_url: x.photo ? `/inventory/${x.id}/photo` : null,
  }));
  res.json(result);
});


//   GET /inventory/:id

app.get("/inventory/:id", (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);

  if (!item) return res.status(404).json({ error: "Item not found" });

  res.json({
    ...item,
    photo_url: item.photo ? `/inventory/${item.id}/photo` : null,
  });
});


//   PUT /inventory/:id

app.put("/inventory/:id", (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);

  if (!item) return res.status(404).json({ error: "Item not found" });

  item.name = req.body.name ?? item.name;
  item.description = req.body.description ?? item.description;

  saveData(items);
  res.json({ message: "Updated", item });
});


//   GET /inventory/:id/photo

app.get("/inventory/:id/photo", (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);

  if (!item || !item.photo) {
    return res.status(404).json({ error: "Photo not found" });
  }

  res.setHeader("Content-Type", "image/jpeg");
  res.sendFile(path.resolve(cacheDir, item.photo));
});


//   PUT /inventory/:id/photo

app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);

  if (!item) return res.status(404).json({ error: "Item not found" });

  if (req.file) {
    item.photo = req.file.filename;
  }

  saveData(items);
  res.json({ message: "Photo updated" });
});


//   DELETE /inventory/:id

app.delete("/inventory/:id", (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);

  if (!item) return res.status(404).json({ error: "Item not found" });

  // Remove photo
  if (item.photo) {
    const fullPath = path.resolve(cacheDir, item.photo);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }

  const newItems = items.filter((i) => i.id !== req.params.id);
  saveData(newItems);

  res.json({ message: "Deleted" });
});


//   POST /search

app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;
  const items = loadData();
  const item = items.find((x) => x.id === id);

  if (!item) return res.status(404).json({ error: "Item not found" });

  let result = {
    id: item.id,
    name: item.name,
    description: item.description,
  };

  if (has_photo) {
    result.photo_url = item.photo ? `/inventory/${item.id}/photo` : null;
  }

  res.json(result);
});


//   405 handler

app.use((req, res) => {
  res.status(405).json({ error: "Method not allowed" });
});


//   Start server

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

