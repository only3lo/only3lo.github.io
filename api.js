import express from 'express';
import cors from 'cors';
import fs from 'fs';

const app = express();

app.set('trust proxy', true);
app.use(express.json());
app.use(cors());

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

// Rate limiting logic
const rateLimitMap = new Map(); // IP -> [timestamps]

function isRateLimited(ip) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10;

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }

    const timestamps = rateLimitMap.get(ip).filter(ts => now - ts < windowMs);
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);

    return timestamps.length > maxRequests;
}

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

app.get("/post-msg/:msg", (req, res) => {
    if (ips[req.ip] === undefined) ips[req.ip] = 0;
    ips[req.ip] += 1;
    saveIps();
    try {
        const ip = req.ip;
        if (isRateLimited(ip)) {
            return res.status(429).json({ error: "Rate limit exceeded. Max 10 posts per minute." });
        }

        msgs.push({ msg: req.params.msg, ts: new Date().toLocaleString(), responses: [] });
        saveMsgs();
        res.json({ message: "success" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/respond/:msg", (req, res) => {
    if (ips[req.ip] === undefined) ips[req.ip] = 0;
    ips[req.ip] += 1;
    saveIps();
    try {
        const ip = req.ip;
        if (isRateLimited(ip)) {
            return res.status(429).json({ error: "Rate limit exceeded. Max 10 responses per minute." });
        }

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
