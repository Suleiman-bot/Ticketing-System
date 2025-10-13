// api/server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import ticketsRouter from "./routes/tickets.js";

dotenv.config(); // load .env variables
connectDB(); // connect to your existing Mongo instance

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(process.cwd(), "data", "uploads")));
app.use("/api/tickets", ticketsRouter);

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Plane backend running on port ${PORT}`));
