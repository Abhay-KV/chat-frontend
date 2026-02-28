const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Chat Server with MongoDB is Running 🚀");
});

/* =========================
   MongoDB Connection
========================= */

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log(err));

/* =========================
   Message Schema
========================= */

const messageSchema = new mongoose.Schema({
  user: String,
  message: String,
  image: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model("Message", messageSchema);

/* =========================
   User Control
========================= */

let users = new Set();
const MAX_USERS = 3;

/* =========================
   Socket Setup
========================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {

  socket.on("join", async (username) => {

    if (!users.has(username) && users.size >= MAX_USERS) {
      socket.emit("room-full");
      return;
    }

    socket.username = username;
    users.add(username);

    // 🔁 Send old chats from DB
    const oldMessages = await Message.find().sort({ timestamp: 1 }).limit(100);
    socket.emit("chat-history", oldMessages);

    socket.broadcast.emit("receive-message", {
      user: "System",
      message: username + " joined",
      notify: true
    });
  });

  socket.on("send-message", async (data) => {

    if (!socket.username) return;

    const newMessage = new Message({
      user: socket.username,
      message: data.message || "",
      image: data.image || ""
    });

    await newMessage.save();   // 💾 Permanent Save

    // Send to sender
    socket.emit("receive-message", {
      ...newMessage._doc,
      notify: false
    });

    // Send to others
    socket.broadcast.emit("receive-message", {
      ...newMessage._doc,
      notify: true
    });
  });

  socket.on("disconnect", () => {
    console.log(socket.username + " disconnected");
  });

});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log("Server running on port " + PORT)
);