const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const mongoose = require("mongoose");

// Initialize Express app
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
const port = process.env.PORT || 3000;

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/welfareDB")
  .then(() => {
    console.log("✅MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("⛔MongoDB connection error:", err);
  });
const socialWorkerSchema = new mongoose.Schema({
  workerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
});

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const homeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  description: String,
  contact: String,
  verified: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ["active", "inactive", "pending"],
    default: "active",
  },
});
const reportSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  workerId: { type: String, required: true },
  personName: { type: String, required: true },
  age: { type: Number, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: String,
  status: {
    type: String,
    enum: ["pending", "resolved"],
    default: "pending",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});
const Admin = mongoose.model("Admin", adminSchema);
const Home = mongoose.model("Home", homeSchema);
const Report = mongoose.model("Report", reportSchema);
const SocialWorker = mongoose.model("SocialWorker", socialWorkerSchema);

// API endpoint for adding social workers
// GET endpoint for retrieving a specific social worker
app.get("/api/social-workers/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const worker = await SocialWorker.findOne({ workerId });

    if (!worker) {
      return res.status(404).json({ message: "Social worker not found" });
    }

    res.json(worker);
  } catch (error) {
    console.error("Error fetching social worker:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/social-workers", async (req, res) => {
  try {
    if (
      !req.body ||
      !req.body.workerId ||
      !req.body.name ||
      !req.body.email ||
      !req.body.password
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { workerId, name, email, password } = req.body;

    // Check if worker with same ID or email exists
    const existingWorker = await SocialWorker.findOne({
      $or: [{ workerId }, { email }],
    });

    if (existingWorker) {
      return res.status(400).json({
        message:
          existingWorker.workerId === workerId
            ? "Worker ID already exists"
            : "Email already registered",
      });
    }

    // Create new social worker
    const socialWorker = new SocialWorker({
      workerId,
      name,
      email,
      password,
      status: "active",
      createdAt: new Date(),
    });

    await socialWorker.save();

    // Update Excel file
    try {
      const currentWorkers = ExcelService.readFile(SOCIAL_WORKERS_FILE);
      currentWorkers.push({
        workerId,
        name,
        email,
        password,
        status: "active",
        createdAt: new Date().toISOString(),
      });
      ExcelService.writeFile(SOCIAL_WORKERS_FILE, currentWorkers);
    } catch (excelError) {
      console.error("Error updating Excel file:", excelError);
      // Continue with the response even if Excel update fails
    }

    res.status(201).json({
      message: "Social worker added successfully",
      workerId: socialWorker.workerId,
    });
  } catch (error) {
    console.error("Error adding social worker:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const REPORTS_FILE = path.join(__dirname, "database", "reports.xlsx");
const HOMES_FILE = path.join(__dirname, "database", "homes.xlsx");
const ADMIN_FILE = path.join(__dirname, "database", "admins.xlsx");
const SOCIAL_WORKERS_FILE = path.join(
  __dirname,
  "database",
  "social-workers.xlsx"
);
const ExcelService = {
  initializeFiles() {
    const dbDir = path.join(__dirname, "database");
    fs.mkdirSync(dbDir, { recursive: true });
    const files = [
      { path: REPORTS_FILE, sheet: "Reports" },
      { path: HOMES_FILE, sheet: "Homes" },
      { path: ADMIN_FILE, sheet: "Admins" },
      { path: SOCIAL_WORKERS_FILE, sheet: "SocialWorkers" },
    ];
    files.forEach((file) => {
      if (!fs.existsSync(file.path)) {
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet([]);
        xlsx.utils.book_append_sheet(wb, ws, file.sheet);
        xlsx.writeFile(wb, file.path);
      }
    });
  },
  readFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`File ${filePath} does not exist, creating new file`);
        this.writeFile(filePath, []);
        return [];
      }
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (error) {
      console.error(`⛔Error reading Excel file ${filePath}:`, error);
      return [];
    }
  },
  writeFile(filePath, data) {
    try {
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
      xlsx.writeFile(wb, filePath);
    } catch (error) {
      console.error(`⛔Error writing Excel file ${filePath}:`, error);
    }
  },
};
const SyncService = {
  async excelToMongo() {
    try {
      const excelReports = ExcelService.readFile(REPORTS_FILE);
      const excelHomes = ExcelService.readFile(HOMES_FILE);
      const excelAdmins = ExcelService.readFile(ADMIN_FILE);
      const excelSocialWorkers = ExcelService.readFile(SOCIAL_WORKERS_FILE);

      // Sync homes with proper handling of verified status
      for (const home of excelHomes) {
        const query = home._id ? { _id: home._id } : { name: home.name };
        const existingHome = await Home.findOne(query);

        if (existingHome) {
          // Preserve verified status if it exists in MongoDB
          const verified =
            typeof home.verified === "boolean"
              ? home.verified
              : existingHome.verified;
          const status = home.status || existingHome.status || "active";

          await Home.findOneAndUpdate(
            query,
            {
              ...home,
              verified,
              status,
              updatedAt: new Date(),
            },
            {
              upsert: true,
              runValidators: true,
            }
          );
        } else {
          // Create new home with default values
          await Home.create({
            ...home,
            verified: Boolean(home.verified),
            status: home.status || "active",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // Sync reports
      await Promise.all(
        excelReports.map((report) =>
          Report.findOneAndUpdate(
            { id: report.id },
            { ...report, updatedAt: new Date() },
            { upsert: true, runValidators: true }
          )
        )
      );

      // Sync admins
      await Promise.all(
        excelAdmins.map((admin) =>
          Admin.findOneAndUpdate(
            { username: admin.username },
            { ...admin, updatedAt: new Date() },
            { upsert: true, runValidators: true }
          )
        )
      );

      // Sync social workers
      await Promise.all(
        excelSocialWorkers.map((worker) =>
          SocialWorker.findOneAndUpdate(
            { workerId: worker.workerId },
            { ...worker, updatedAt: new Date() },
            { upsert: true, runValidators: true }
          )
        )
      );

      console.log("✅Excel to MongoDB sync completed");
    } catch (error) {
      console.error("⛔Excel to MongoDB sync error:", error);
    }
  },

  async mongoToExcel() {
    try {
      const [mongoReports, mongoHomes, mongoAdmins] = await Promise.all([
        Report.find(),
        Home.find(),
        Admin.find(),
      ]);

      // Transform data before writing to Excel
      const homes = mongoHomes.map((home) => ({
        ...home.toObject(),
        verified: Boolean(home.verified),
        status: home.status || "active",
      }));

      ExcelService.writeFile(REPORTS_FILE, mongoReports);
      ExcelService.writeFile(HOMES_FILE, homes);
      ExcelService.writeFile(ADMIN_FILE, mongoAdmins);

      console.log("✅MongoDB to Excel sync completed");
    } catch (error) {
      console.error("⛔MongoDB to Excel sync error:", error);
    }
  },
};
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  })
);
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.post("/api/reports", upload.single("image"), async (req, res) => {
  try {
    const newReport = {
      id: Date.now(),
      workerId: req.body.workerId,
      personName: req.body.personName,
      age: parseInt(req.body.age),
      location: req.body.location,
      description: req.body.description,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    };

    const savedReport = await Report.create(newReport);
    const reports = ExcelService.readFile(REPORTS_FILE);
    reports.push(newReport);
    ExcelService.writeFile(REPORTS_FILE, reports);

    res.status(201).json(savedReport);
  } catch (error) {
    console.error("⛔Report submission error:", error);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

app.post("/api/admin/register", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if admin already exists in MongoDB
    const existingMongoAdmin = await Admin.findOne({
      $or: [{ username }, { email }],
    });

    // Check if admin exists in Excel
    const excelAdmins = ExcelService.readFile(ADMIN_FILE);
    const existingExcelAdmin = excelAdmins.find(
      (a) => a.username === username || a.email === email
    );

    if (existingMongoAdmin || existingExcelAdmin) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }

    // Create new admin in MongoDB
    const newAdmin = await Admin.create({
      username,
      email,
      password,
    });

    // Add to Excel
    excelAdmins.push({
      username,
      email,
      password,
    });
    ExcelService.writeFile(ADMIN_FILE, excelAdmins);

    // Return success without password
    const { password: _, ...adminData } = newAdmin.toObject();
    res.status(201).json(adminData);
  } catch (error) {
    console.error("⛔Admin registration error:", error);
    res.status(500).json({ error: "Failed to register admin" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const mongoAdmin = await Admin.findOne({ username, password }).select(
      "-password"
    );
    const excelAdmins = ExcelService.readFile(ADMIN_FILE);
    const excelAdmin = excelAdmins.find(
      (a) => a.username === username && a.password === password
    );

    const admin = mongoAdmin || excelAdmin;
    if (admin) {
      res.json({
        token: process.env.ADMIN_TOKEN || "admin-token-123",
        username: admin.username,
        email: admin.email,
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("⛔Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});
// Get all social workers endpoint
app.get("/api/social-workers", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const mongoWorkers = await SocialWorker.find();
    const excelWorkers = ExcelService.readFile(SOCIAL_WORKERS_FILE);
    const uniqueWorkers = [...mongoWorkers, ...excelWorkers].filter(
      (worker, index, self) =>
        index === self.findIndex((w) => w.workerId === worker.workerId)
    );

    res.json(uniqueWorkers);
  } catch (error) {
    console.error("⛔Fetch social workers error:", error);
    res.status(500).json({ error: "Failed to fetch social workers" });
  }
});

app.get("/api/homes", async (req, res) => {
  try {
    const mongoHomes = await Home.find();
    const excelHomes = ExcelService.readFile(HOMES_FILE);
    const uniqueHomes = [...mongoHomes, ...excelHomes].filter(
      (home, index, self) =>
        index === self.findIndex((h) => h.name === home.name)
    );
    res.json(uniqueHomes);
  } catch (error) {
    console.error("⛔Fetch homes error:", error);
    res.status(500).json({ error: "Failed to fetch homes" });
  }
});
app.get("/api/reports", async (req, res) => {
  try {
    const mongoReports = await Report.find().sort({ timestamp: -1 });
    const excelReports = ExcelService.readFile(REPORTS_FILE);
    const uniqueReports = [...mongoReports, ...excelReports].filter(
      (report, index, self) =>
        index === self.findIndex((r) => r.id === report.id)
    );
    res.json(uniqueReports);
  } catch (error) {
    console.error("⛔Fetch reports error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.get("/api/reports/worker/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const mongoReports = await Report.find({ workerId }).sort({
      timestamp: -1,
    });
    const excelReports = ExcelService.readFile(REPORTS_FILE).filter(
      (r) => r.workerId === workerId
    );
    const uniqueReports = [...mongoReports, ...excelReports].filter(
      (report, index, self) =>
        index === self.findIndex((r) => r.id === report.id)
    );
    res.json(uniqueReports);
  } catch (error) {
    console.error("⛔Fetch worker reports error:", error);
    res.status(500).json({ error: "Failed to fetch worker reports" });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const [mongoReports, excelReports] = await Promise.all([
      Report.find(),
      Promise.resolve(ExcelService.readFile(REPORTS_FILE)),
    ]);

    const allReports = [...mongoReports, ...excelReports].filter(
      (report, index, self) =>
        index === self.findIndex((r) => r.id === report.id)
    );

    const stats = {
      totalReports: allReports.length,
      activeReports: allReports.filter((r) => r.status === "pending").length,
      resolvedCases: allReports.filter((r) => r.status === "resolved").length,
      lastUpdate: new Date(),
    };

    res.json(stats);
  } catch (error) {
    console.error("⛔Stats fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
// Add new home endpoint
app.post("/api/homes", async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const newHome = {
      name: req.body.name,
      location: req.body.location,
      lat: req.body.lat,
      lng: req.body.lng,
      description: req.body.description,
      contact: req.body.contact,
    };

    // Save to MongoDB
    const savedHome = await Home.create(newHome);

    // Save to Excel
    const homes = ExcelService.readFile(HOMES_FILE);
    homes.push(newHome);
    ExcelService.writeFile(HOMES_FILE, homes);

    res.status(201).json(savedHome);
  } catch (error) {
    console.error("⛔Add home error:", error);
    res.status(500).json({ error: "Failed to add home" });
  }
});
// Update the resolve endpoint
app.post("/api/reports/:id/resolve", async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    // Validate report ID
    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ error: "Invalid report ID" });
    }

    // Check authentication
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updatedReport = await Report.findOneAndUpdate(
      { id: reportId },
      { status: "resolved" },
      { new: true }
    );

    if (!updatedReport) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Update Excel file
    const reports = ExcelService.readFile(REPORTS_FILE);
    const reportIndex = reports.findIndex((r) => r.id === reportId);
    if (reportIndex !== -1) {
      reports[reportIndex].status = "resolved";
      ExcelService.writeFile(REPORTS_FILE, reports);
    }

    res.json(updatedReport);
  } catch (error) {
    console.error("⛔Resolve case error:", error);
    res.status(500).json({ error: "Failed to resolve case" });
  }
});
// Add delete endpoint
app.delete("/api/reports/:id", async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ error: "Invalid report ID" });
    }

    // Check authentication
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Delete from MongoDB
    const deletedReport = await Report.findOneAndDelete({ id: reportId });
    if (!deletedReport) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Delete from Excel
    const reports = ExcelService.readFile(REPORTS_FILE);
    const updatedReports = reports.filter((r) => r.id !== reportId);
    ExcelService.writeFile(REPORTS_FILE, updatedReports);

    // Delete associated image if exists
    if (deletedReport.imageUrl) {
      const imagePath = path.join(__dirname, deletedReport.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error("⛔Delete report error:", error);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// Add modify endpoint
app.put("/api/reports/:id", upload.single("image"), async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ error: "Invalid report ID" });
    }

    // Check authentication
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updateData = {
      workerId: req.body.workerId,
      personName: req.body.personName,
      age: parseInt(req.body.age),
      location: req.body.location,
      description: req.body.description,
    };

    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;

      // Delete old image if exists
      const oldReport = await Report.findOne({ id: reportId });
      if (oldReport?.imageUrl) {
        const oldImagePath = path.join(__dirname, oldReport.imageUrl);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    // Update in MongoDB
    const updatedReport = await Report.findOneAndUpdate(
      { id: reportId },
      updateData,
      { new: true }
    );

    if (!updatedReport) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Update in Excel
    const reports = ExcelService.readFile(REPORTS_FILE);
    const reportIndex = reports.findIndex((r) => r.id === reportId);
    if (reportIndex !== -1) {
      reports[reportIndex] = { ...reports[reportIndex], ...updateData };
      ExcelService.writeFile(REPORTS_FILE, reports);
    }

    res.json(updatedReport);
  } catch (error) {
    console.error("⛔Modify report error:", error);
    res.status(500).json({ error: "Failed to modify report" });
  }
});

app.post("/api/admin/register", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if admin already exists in MongoDB
    const existingMongoAdmin = await Admin.findOne({
      $or: [{ username }, { email }],
    });

    // Check if admin exists in Excel
    const excelAdmins = ExcelService.readFile(ADMIN_FILE);
    const existingExcelAdmin = excelAdmins.find(
      (a) => a.username === username || a.email === email
    );

    if (existingMongoAdmin || existingExcelAdmin) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }

    // Create new admin in MongoDB
    const newAdmin = await Admin.create({
      username,
      email,
      password,
    });

    // Add to Excel
    excelAdmins.push({
      username,
      email,
      password,
    });
    ExcelService.writeFile(ADMIN_FILE, excelAdmins);

    // Return success without password
    const { password: _, ...adminData } = newAdmin.toObject();
    res.status(201).json(adminData);
  } catch (error) {
    console.error("⛔Admin registration error:", error);
    res.status(500).json({ error: "Failed to register admin" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const mongoAdmin = await Admin.findOne({ username, password }).select(
      "-password"
    );
    const excelAdmins = ExcelService.readFile(ADMIN_FILE);
    const excelAdmin = excelAdmins.find(
      (a) => a.username === username && a.password === password
    );

    const admin = mongoAdmin || excelAdmin;
    if (admin) {
      res.json({
        token: process.env.ADMIN_TOKEN || "admin-token-123",
        username: admin.username,
        email: admin.email,
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("⛔Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get all social workers endpoint
app.get("/api/social-workers", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const mongoWorkers = await SocialWorker.find();
    const excelWorkers = ExcelService.readFile(SOCIAL_WORKERS_FILE);
    const uniqueWorkers = [...mongoWorkers, ...excelWorkers].filter(
      (worker, index, self) =>
        index === self.findIndex((w) => w.workerId === worker.workerId)
    );

    res.json(uniqueWorkers);
  } catch (error) {
    console.error("⛔Fetch social workers error:", error);
    res.status(500).json({ error: "Failed to fetch social workers" });
  }
});

app.get("/api/homes", async (req, res) => {
  try {
    const mongoHomes = await Home.find();
    const excelHomes = ExcelService.readFile(HOMES_FILE);
    const uniqueHomes = [...mongoHomes, ...excelHomes].filter(
      (home, index, self) =>
        index === self.findIndex((h) => h.name === home.name)
    );
    res.json(uniqueHomes);
  } catch (error) {
    console.error("⛔Fetch homes error:", error);
    res.status(500).json({ error: "Failed to fetch homes" });
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const mongoReports = await Report.find().sort({ timestamp: -1 });
    const excelReports = ExcelService.readFile(REPORTS_FILE);
    const uniqueReports = [...mongoReports, ...excelReports].filter(
      (report, index, self) =>
        index === self.findIndex((r) => r.id === report.id)
    );
    res.json(uniqueReports);
  } catch (error) {
    console.error("⛔Fetch reports error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.get("/api/reports/worker/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const mongoReports = await Report.find({ workerId }).sort({
      timestamp: -1,
    });
    const excelReports = ExcelService.readFile(REPORTS_FILE).filter(
      (r) => r.workerId === workerId
    );
    const uniqueReports = [...mongoReports, ...excelReports].filter(
      (report, index, self) =>
        index === self.findIndex((r) => r.id === report.id)
    );
    res.json(uniqueReports);
  } catch (error) {
    console.error("⛔Fetch worker reports error:", error);
    res.status(500).json({ error: "Failed to fetch worker reports" });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const [mongoReports, excelReports] = await Promise.all([
      Report.find(),
      Promise.resolve(ExcelService.readFile(REPORTS_FILE)),
    ]);

    const allReports = [...mongoReports, ...excelReports].filter(
      (report, index, self) =>
        index === self.findIndex((r) => r.id === report.id)
    );

    const stats = {
      totalReports: allReports.length,
      activeReports: allReports.filter((r) => r.status === "pending").length,
      resolvedCases: allReports.filter((r) => r.status === "resolved").length,
      lastUpdate: new Date(),
    };

    res.json(stats);
  } catch (error) {
    console.error("⛔Stats fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
// Get single home endpoint
app.get("/api/homes/:id", async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const home = await Home.findById(req.params.id);

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    res.json(home);
  } catch (error) {
    console.error("⛔Get home error:", error);
    res.status(500).json({ error: "Failed to get home" });
  }
});

// Update home endpoint
app.put("/api/homes/:id", async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate required fields
    const { name, location, lat, lng } = req.body;
    if (
      !name ||
      !location ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "Missing or invalid required fields" });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // Validate status if provided
    if (
      req.body.status &&
      !["active", "inactive", "pending"].includes(req.body.status)
    ) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const updateData = {
      name,
      location,
      lat,
      lng,
      description: req.body.description,
      contact: req.body.contact,
      verified: Boolean(req.body.verified),
      status: req.body.status || "active",
      updatedAt: new Date(),
    };

    // Update in MongoDB
    const updatedHome = await Home.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedHome) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Update Excel file
    const homes = ExcelService.readFile(HOMES_FILE);
    const index = homes.findIndex(
      (h) => h._id?.toString() === req.params.id || h.name === updatedHome.name
    );

    if (index !== -1) {
      homes[index] = {
        ...homes[index],
        ...updateData,
        _id: req.params.id,
      };
    } else {
      homes.push({
        ...updateData,
        _id: req.params.id,
      });
    }

    ExcelService.writeFile(HOMES_FILE, homes);

    // Trigger immediate sync
    await Promise.all([SyncService.excelToMongo(), SyncService.mongoToExcel()]);

    res.json(updatedHome);
  } catch (error) {
    console.error("⛔Update home error:", error);
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ error: "Validation failed", details: error.message });
    }
    res.status(500).json({ error: "Failed to update home" });
  }
});

// Admin routes
app.get("/api/admins", async (req, res) => {
  try {
    const admins = await Admin.find({}, { password: 0 });
    res.json(
      admins.map((admin) => ({
        ...admin.toObject(),
        source: "MongoDB",
        updatedAt: admin.updatedAt || new Date(),
      }))
    );
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "Failed to fetch admin data" });
  }
});

// Update admin endpoint
app.put("/api/admins/:id", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Find the admin
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Update fields
    if (username) admin.username = username;
    if (email) admin.email = email;
    if (password) admin.password = password;

    // Save changes
    await admin.save();

    // Return updated admin without password
    const updatedAdmin = admin.toObject();
    delete updatedAdmin.password;

    res.json(updatedAdmin);
  } catch (error) {
    console.error("Error updating admin:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }
    res.status(500).json({ error: "Failed to update admin" });
  }
});

// Social Worker routes

// Social worker login endpoint
app.post("/api/social-worker/login", async (req, res) => {
  try {
    const { workerId, password } = req.body;

    if (!workerId || !password) {
      return res
        .status(400)
        .json({ error: "Worker ID and password are required" });
    }

    // Check MongoDB first
    const worker = await SocialWorker.findOne({ workerId, password });

    // If not in MongoDB, check Excel
    if (!worker) {
      const excelWorkers = ExcelService.readFile(SOCIAL_WORKERS_FILE);
      const excelWorker = excelWorkers.find(
        (w) => w.workerId === workerId && w.password === password
      );

      if (!excelWorker) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Update last login in Excel
      excelWorker.lastLogin = new Date().toISOString();
      ExcelService.writeFile(SOCIAL_WORKERS_FILE, excelWorkers);

      return res.json({
        token: `sw-${workerId}-${Date.now()}`,
        workerId: excelWorker.workerId,
      });
    }

    // Update last login in MongoDB
    worker.lastLogin = new Date();
    await worker.save();

    res.json({
      token: `sw-${workerId}-${Date.now()}`,
      workerId: worker.workerId,
    });
  } catch (error) {
    console.error("⛔Social worker login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/social-workers", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const socialWorkers = await SocialWorker.find();
    res.json(
      socialWorkers.map((worker) => ({
        workerId: worker.workerId,
        name: worker.name,
        email: worker.email,
        isActive: worker.status === "active",
        lastActive: worker.lastLogin,
      }))
    );
  } catch (error) {
    console.error("⛔Fetch social workers error:", error);
    res.status(500).json({ error: "Failed to fetch social workers" });
  }
});

// Toggle social worker status endpoint
app.post("/api/social-worker/:workerId/toggle-status", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workerId } = req.params;
    const worker = await SocialWorker.findOne({ workerId });

    if (!worker) {
      return res.status(404).json({ error: "Social worker not found" });
    }

    // Toggle status
    worker.status = worker.status === "active" ? "inactive" : "active";
    await worker.save();

    // Update Excel file
    const workers = ExcelService.readFile(SOCIAL_WORKERS_FILE);
    const workerIndex = workers.findIndex((w) => w.workerId === workerId);
    if (workerIndex !== -1) {
      workers[workerIndex].status = worker.status;
      ExcelService.writeFile(SOCIAL_WORKERS_FILE, workers);
    }

    res.json({
      workerId: worker.workerId,
      isActive: worker.status === "active",
    });
  } catch (error) {
    console.error("⛔Toggle status error:", error);
    res.status(500).json({ error: "Failed to toggle status" });
  }
});

// Reset social worker password endpoint
app.post("/api/social-worker/:workerId/reset-password", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== (process.env.ADMIN_TOKEN || "admin-token-123")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workerId } = req.params;
    const worker = await SocialWorker.findOne({ workerId });

    if (!worker) {
      return res.status(404).json({ error: "Social worker not found" });
    }

    // Generate temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8);
    worker.password = temporaryPassword;
    await worker.save();

    // Update Excel file
    const workers = ExcelService.readFile(SOCIAL_WORKERS_FILE);
    const workerIndex = workers.findIndex((w) => w.workerId === workerId);
    if (workerIndex !== -1) {
      workers[workerIndex].password = temporaryPassword;
      ExcelService.writeFile(SOCIAL_WORKERS_FILE, workers);
    }

    res.json({ temporaryPassword });
  } catch (error) {
    console.error("⛔Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// Initialize data and start server
async function initializeData() {
  try {
    ExcelService.initializeFiles();
    await Promise.all([SyncService.excelToMongo(), SyncService.mongoToExcel()]);
  } catch (error) {
    console.error("⛔Data initialization error:", error);
  }
}

initializeData();
app.listen(port, () => {
  console.log(`👉Server running at http://localhost:${port}`);
});

// Periodic sync every 5 minutes
setInterval(async () => {
  await Promise.all([SyncService.excelToMongo(), SyncService.mongoToExcel()]);
  console.log("🤝Data synchronized between Excel and MongoDB");
}, 5 * 60 * 1000);
