import express from 'express';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { rateLimit } from 'express-rate-limit'

dotenv.config();

const app = express();

const limiter = rateLimit({
	windowMs: 30 * 1000, // 15 minutes
	limit: 3, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
});

app.use(limiter);

app.set('trust proxy', true);
app.use(express.json());
app.use(cors());

const genAI = new GoogleGenerativeAI(process.env.GKEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const filter = "Please check if the message from user violates guidelines: 'Direct threats are disallowed. Critisism is allowd always (saying that someone is stupid anything more offensive should be filtered) bad words at the level of 'f*ck' should also be filtered CALLING SOMEONE STUPID IS ALWAYS OKAY, DO NOT FILTER IT! BLOCK ALL SEXUAL OFFENSIVE MESSAGES' ALWAYS ANWSER ONLY ONE WORD: 'yes'  or 'no' Message from user: '";


let msgs = [];
function saveMsgs() {
    fs.writeFileSync("./msgs.json", JSON.stringify(msgs, null, 4));
}
if (fs.existsSync("./msgs.json")) msgs = JSON.parse(fs.readFileSync("./msgs.json"));

let ips = {};
function saveIps() {
    fs.writeFileSync("./ips.json", JSON.stringify(ips, null, 4));
}
if (fs.existsSync("./ips.json")) ips = JSON.parse(fs.readFileSync("./ips.json"));

app.get("/msgs", (req, res) => {
    if (ips[req.ip] === undefined) ips[req.ip] = 0;
    ips[req.ip] += 1;
    saveIps();
    try {
        res.json({ msgs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/ips", (_, res) => {
    try {
        res.json({ ips });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/post-msg/:msg", async (req, res) => {
    if (ips[req.ip] === undefined) ips[req.ip] = 0;
    ips[req.ip] += 1;
    saveIps();
    try {
        const ip = req.ip;
        if ((await model.generateContent(filter + req.params.msg + "'")).response.text().toLowerCase().replaceAll("\n", '') !== "no") throw new Error("Offensive message!");

        msgs.push({ msg: req.params.msg, ts: new Date().toLocaleString(), responses: [] });
        saveMsgs();
        res.json({ message: "success" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/respond/:msg", async (req, res) => {
    if (ips[req.ip] === undefined) ips[req.ip] = 0;
    ips[req.ip] += 1;
    saveIps();
    try {
        const ip = req.ip;
        if ((await model.generateContent(filter + req.params.msg + "'")).response.text().toLowerCase().replaceAll("\n", '') !== "no") throw new Error("Offensive message!");

        if (req.query.msgid === undefined) throw new Error("msgid param not passed!");
        const msgIndex = parseInt(req.query.msgid);
        msgs[msgIndex].responses.push(req.params.msg);
        msgs[msgIndex].ts = new Date().toLocaleString();
        saveMsgs();
        res.json({ message: "success" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on http://0.0.0.0:3000");
});
