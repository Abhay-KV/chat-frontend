require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

// 🔌 Socket Setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 🟢 MongoDB Connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log(err));

// 🟢 Chat Schema
const chatSchema = new mongoose.Schema({
  name: String,
  message: String,
  time: {
    type: Date,
    default: Date.now
  }
});

const Chat = mongoose.model("Chat", chatSchema);

// 👥 Only 3 users allowed
let activeUsers = [];

// 🚀 Socket Logic
io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  // 📌 When user joins
  socket.on("join", async (name) => {

    if (activeUsers.length >= 3) {
      socket.emit("roomFull");
      return;
    }

    socket.username = name;
    activeUsers.push(name);

    // Send old chats
    const oldChats = await Chat.find().sort({ time: 1 });
    socket.emit("loadOldChats", oldChats);

    io.emit("userList", activeUsers);
  });

  // 💬 When message sent
  socket.on("sendMessage", async (msg) => {

    const newChat = new Chat({
      name: socket.username,
      message: msg
    });

    await newChat.save();

    // Send message to all
    io.emit("receiveMessage", newChat);

    // 🔔 Send notification to other 2 users
    socket.broadcast.emit("notification", {
      from: socket.username,
      message: msg
    });

  });

  // ❌ When user disconnect
  socket.on("disconnect", () => {

    if (socket.username) {
      activeUsers = activeUsers.filter(u => u !== socket.username);
      io.emit("userList", activeUsers);
    }

    console.log("User disconnected:", socket.id);
  });

});

app.get("/", (req, res) => {
  res.send("Chat Server is running 🚀");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
