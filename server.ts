import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// In this environment, the credentials are often handled by the service account
// or we can use the project ID from the config.
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  /**
   * /api/tasks
   * Fetches manual tasks added by admin.
   */
  app.get("/api/tasks", async (req, res) => {
    try {
      const tasksSnapshot = await db.collection("manual_tasks")
        .where("active", "==", true)
        .orderBy("created_at", "desc")
        .get();

      const tasks: any[] = [];
      tasksSnapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
      });
      
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  /**
   * /api/admin/approve-task
   * Admin approves a task submission and releases funds.
   */
  app.post("/api/admin/approve-task", async (req, res) => {
    const { submissionId, adminUid } = req.body;

    if (!submissionId || !adminUid) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    try {
      const submissionRef = db.collection("task_submissions").doc(submissionId);
      const submissionDoc = await submissionRef.get();

      if (!submissionDoc.exists) {
        return res.status(404).json({ error: "Submission not found" });
      }

      const submissionData = submissionDoc.data();
      if (!submissionData || submissionData.status !== "pending") {
        return res.status(400).json({ error: "Submission is not pending" });
      }

      const { user_id, payout_khr, admin_profit_usd, task_id } = submissionData;

      const batch = db.batch();

      // 1. Update submission status
      batch.update(submissionRef, {
        status: "approved",
        approved_at: FieldValue.serverTimestamp(),
        approved_by: adminUid
      });

      // 2. Update user balance
      const userRef = db.collection("users").doc(user_id);
      batch.update(userRef, {
        verified_balance: FieldValue.increment(payout_khr)
      });

      // 3. Log payout history for user
      const historyRef = userRef.collection("payout_history").doc();
      batch.set(historyRef, {
        amount: payout_khr,
        timestamp: FieldValue.serverTimestamp(),
        source: "Manual_Task_Verification",
        status: "completed",
        task_id: task_id
      });

      // 4. Update admin stats
      const adminStatsRef = db.collection("admin_finances").doc("stats");
      batch.set(adminStatsRef, {
        total_profit_usd: FieldValue.increment(admin_profit_usd),
        last_updated: FieldValue.serverTimestamp()
      }, { merge: true });

      // 5. Log admin profit
      const profitLogRef = db.collection("admin_finances_logs").doc();
      batch.set(profitLogRef, {
        amount_usd: admin_profit_usd,
        timestamp: FieldValue.serverTimestamp(),
        task_id: task_id,
        user_id: user_id
      });

      await batch.commit();

      res.json({ success: true });
    } catch (error) {
      console.error("Error approving task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  /**
   * /api/admin/finances
   * Returns financial overview for the admin.
   */
  app.get("/api/admin/finances", async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);

      // 1. Calculate Today's Profit from Manual Task Logs
      let todayProfitUsd = 0;
      try {
        const logsSnapshot = await db.collection("admin_finances_logs")
          .where("timestamp", ">=", todayTimestamp)
          .get();

        logsSnapshot.forEach(doc => {
          todayProfitUsd += doc.data().amount_usd || 0;
        });
      } catch (e) {
        console.error("Error fetching admin_finances_logs:", e);
      }

      // 2. Pending Payments (Users with balance > 0)
      let pendingPayments: any[] = [];
      try {
        const usersSnapshot = await db.collection("users")
          .where("verified_balance", ">", 0)
          .get();

        usersSnapshot.forEach(doc => {
          const data = doc.data();
          pendingPayments.push({
            uid: doc.id,
            display_name: data.display_name,
            email: data.email,
            balance_khr: data.verified_balance,
            aba_status: data.aba_status
          });
        });
      } catch (e) {
        console.error("Error fetching pending users:", e);
      }

      res.json({
        today_profit_usd: todayProfitUsd,
        pending_payments: pendingPayments,
        payout_date: "25th of the month"
      });
    } catch (error) {
      console.error("Financial Overview Error:", error);
      res.status(500).json({ error: "Failed to fetch financial data" });
    }
  });

  /**
   * /api/admin/env
   * Returns environment variables for the admin terminal.
   */
  app.get("/api/admin/env", async (req, res) => {
    const envVars = {
      CPX_APP_ID: process.env.CPX_APP_ID || "",
      CPX_API_KEY: process.env.CPX_API_KEY ? "PRESENT (HIDDEN)" : "MISSING",
      CPX_SECURE_HASH: process.env.CPX_SECURE_HASH ? "PRESENT (HIDDEN)" : "MISSING",
      BITLABS_API_TOKEN: process.env.BITLABS_API_TOKEN || "",
      BITLABS_SECRET_KEY: process.env.BITLABS_SECRET_KEY ? "PRESENT (HIDDEN)" : "MISSING",
      SURVEY_SECRET_KEY: process.env.SURVEY_SECRET_KEY || "",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "PRESENT (HIDDEN)" : "MISSING",
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
      NODE_ENV: process.env.NODE_ENV || "development"
    };
    res.json(envVars);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
