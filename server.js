require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 5000;
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const EXPORT_DIR = path.join(__dirname, "exports");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

function seed() {
  return {
    students: [
      { id: "s1", name: "Anjum Kaginalli", usn: "2AV23CG005", email: "anjum@example.com", branch: "CSD", cgpa: 8.2, backlogs: 0 },
      { id: "s2", name: "Zohra", usn: "2AV23CG008", email: "zohra@example.com", branch: "CSE", cgpa: 8.5, backlogs: 0 },
      { id: "s3", name: "Afsheen", usn: "2AV23CG009", email: "afsheen@example.com", branch: "AIML", cgpa: 7.1, backlogs: 1 },
      { id: "s4", name: "Maryam", usn: "2AV23CG010", email: "maryam@example.com", branch: "CSD", cgpa: 8.0, backlogs: 0 }
    ],
    companies: [
      { id: "c1", name: "Quest Global", industry: "Engineering & Technology", openings: 3, roles: ["Graduate Engineer", "Software Engineer"] },
      { id: "c2", name: "TCS", industry: "IT Services", openings: 5, roles: ["Graduate Engineer Trainee", "Developer"] },
      { id: "c3", name: "Infosys", industry: "Information Technology", openings: 4, roles: ["Software Engineer", "System Engineer"] }
    ],
    applications: [
      { id: "a1", studentId: "s1", companyId: "c1", role: "Graduate Engineer", date: "2026-10-04", status: "Applied" },
      { id: "a2", studentId: "s2", companyId: "c3", role: "Software Engineer", date: "2026-10-03", status: "Applied" },
      { id: "a3", studentId: "s4", companyId: "c2", role: "Developer", date: "2026-10-02", status: "Applied" }
    ],
    lastRun: null,
    lastAutomation: null
  };
}

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seed(), null, 2));
}
ensureStore();

function readDB() { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
function writeDB(db) { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function eligible(s) { return Number(s.cgpa) >= 7.5 && Number(s.backlogs) === 0; }

app.get("/api/health", (_, res) => res.json({ ok: true, service: "Placement RPA API", time: new Date().toISOString() }));

app.get("/api/students", (_, res) => res.json(readDB().students));
app.post("/api/students", (req, res) => {
  const db = readDB(), b = req.body;
  if (!b.name || !b.usn || !b.email || b.cgpa === undefined) return res.status(400).json({ error: "name, usn, email and cgpa are required" });
  const s = { id: uid("s"), name: b.name.trim(), usn: b.usn.trim().toUpperCase(), email: b.email.trim(), branch: b.branch || "CSE", cgpa: Number(b.cgpa), backlogs: Number(b.backlogs || 0) };
  db.students.push(s); writeDB(db); res.status(201).json({ ...s, eligible: eligible(s) });
});
app.delete("/api/students/:id", (req, res) => {
  const db = readDB(), id = req.params.id;
  db.students = db.students.filter(s => s.id !== id);
  db.applications = db.applications.filter(a => a.studentId !== id);
  writeDB(db); res.json({ ok: true });
});

app.delete("/api/students/:id", (req, res) => {
  const db = readDB(), id = req.params.id;
  db.students = db.students.filter(s => s.id !== id);
  db.applications = db.applications.filter(a => a.studentId !== id);
  writeDB(db);
  res.json({ ok: true });
});


// PASTE THE EMAIL CODE HERE
app.post("/api/send-email", async (req, res) => {

  try {
    const { studentId, subject, message } = req.body;

    if (!studentId) {
      return res.status(400).json({
        error: "studentId is required"
      });
    }

    const db = readDB();

    const student = db.students.find(
      s => s.id === studentId
    );

    if (!student) {
      return res.status(404).json({
        error: "Student not found"
      });
    }

    if (!student.email) {
      return res.status(400).json({
        error: "Student does not have an email address"
      });
    }

    const mailOptions = {
      from: `"Placement RPA" <${process.env.SMTP_USER}>`,
      to: student.email,
      subject: subject || "Placement Update",
      text: message || `Dear ${student.name},

This is an update from the Placement RPA system.

Regards,
Placement Cell`
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(
      `Email sent to ${student.name} (${student.email})`
    );

    res.json({
      ok: true,
      message: "Email sent successfully",
      student: student.name,
      email: student.email,
      messageId: info.messageId
    });

  } catch (error) {

    console.error("Email error:", error);

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.get("/api/companies", (_, res) => res.json(readDB().companies));
app.post("/api/companies", (req, res) => {
  const db = readDB(), b = req.body;
  if (!b.name) return res.status(400).json({ error: "name is required" });
  const c = { id: uid("c"), name: b.name.trim(), industry: b.industry || "IT Services", openings: Number(b.openings || 1), roles: Array.isArray(b.roles) ? b.roles : b.roles.split(",").map(x => x.trim()).filter(Boolean) };
  db.companies.push(c); writeDB(db); res.status(201).json(c);
});

app.get("/api/applications", (_, res) => res.json(readDB().applications));
app.post("/api/applications", (req, res) => {
  const db = readDB(), b = req.body;
  if (!b.studentId || !b.companyId || !b.role) return res.status(400).json({ error: "studentId, companyId and role are required" });
  const a = { id: uid("a"), studentId: b.studentId, companyId: b.companyId, role: b.role, date: b.date || new Date().toISOString().slice(0, 10), status: "Applied" };
  db.applications.push(a); writeDB(db); res.status(201).json(a);
});
app.patch("/api/applications/:id", (req, res) => {
  const db = readDB(), a = db.applications.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: "application not found" });
  if (req.body.status) a.status = req.body.status;
  writeDB(db); res.json(a);
});

app.get("/api/dashboard", (_, res) => {
  const db = readDB(), eligibleCount = db.students.filter(eligible).length;
  res.json({
    students: db.students.length, companies: db.companies.length, eligible: eligibleCount,
    shortlisted: db.applications.filter(a => a.status === "Shortlisted").length,
    selected: db.applications.filter(a => a.status === "Selected").length,
    lastRun: db.lastRun
  });
});

/* This is the demonstration automation engine.
   UiPath can call this same endpoint after replacing it with an Orchestrator job trigger. */
app.post("/api/automation/run", (req, res) => {
  const db = readDB();
  let changed = 0;
  const eligibleStudents = db.students.filter(eligible);
  db.applications.forEach(a => {
    const s = db.students.find(x => x.id === a.studentId);
    if (!s) return;
    if (eligible(s) && (a.status === "Applied" || a.status === "Eligible")) { a.status = "Shortlisted"; changed++; }
    if (!eligible(s) && a.status === "Applied") { a.status = "Rejected"; changed++; }
  });
  db.lastRun = new Date().toISOString();
  db.lastAutomation = {
    runId: uid("run"),
    source: req.body?.source || "frontend",
    completedAt: db.lastRun,
    studentsRead: db.students.length,
    eligibleCount: eligibleStudents.length,
    recordsChanged: changed
  };
  writeDB(db);
  res.json({ ok: true, ...db.lastAutomation, shortlisted: db.applications.filter(a => a.status === "Shortlisted").length });
});

/* UiPath callback endpoint:
   UiPath can POST its final output here after processing an Excel/CSV file. */
app.post("/api/uipath/callback", (req, res) => {
  const db = readDB();
  const result = req.body || {};
  if (Array.isArray(result.applications)) {
    for (const incoming of result.applications) {
      const a = db.applications.find(x => x.id === incoming.id);
      if (a && incoming.status) a.status = incoming.status;
    }
  }
  db.lastAutomation = { ...(db.lastAutomation || {}), source: "uipath", completedAt: new Date().toISOString(), uipathResult: result };
  db.lastRun = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true, message: "UiPath result received and database updated" });
});

app.get("/api/reports/eligibility", (req, res) => {
  const db = readDB();
  const rows = db.students.map(s => ({ ...s, eligibility: eligible(s) ? "Eligible" : "Not Eligible" }));
  res.json({ generatedAt: new Date().toISOString(), total: rows.length, eligible: rows.filter(x => x.eligibility === "Eligible").length, rows });
});

app.get("/api/reports/eligibility.csv", (req, res) => {
  const db = readDB();
  const header = "Student,USN,Branch,CGPA,Backlogs,Eligibility\n";
  const body = db.students.map(s => [s.name, s.usn, s.branch, s.cgpa, s.backlogs, eligible(s) ? "Eligible" : "Not Eligible"]
    .map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const file = path.join(EXPORT_DIR, "placement-eligibility-report.csv");
  fs.writeFileSync(file, header + body);
  res.download(file, "placement-eligibility-report.csv");
});

app.post("/api/reset", (_, res) => { fs.writeFileSync(DATA_FILE, JSON.stringify(seed(), null, 2)); res.json({ ok: true }); });

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route not found" });
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.listen(PORT, () => console.log(`Placement RPA running at http://localhost:${PORT}`));
