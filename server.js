require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();

// Define allowed origins (local and production)
const allowedOrigins = [
  "http://localhost:3000",  // For local development
  "https://sunil-sahoo-wasserstoff.onrender.com", // Replace this with your actual Render frontend URL
];

// CORS setup: Allow only specified origins
app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      // Allow requests from localhost or the specified Render URL
      callback(null, true);
    } else {
      // Reject requests from other origins
      callback(new Error("CORS policy violation"), false);
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"), false);
      }
    },
    methods: ["GET", "POST"]
  }
});

let users = new Map(); // socketId => username

// Listen for client connections
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Check if the username is unique
  socket.on("check-username", (name, callback) => {
    const isUnique = ![...users.values()].includes(name);
    callback(isUnique);
  });

  // Handle user joining
  socket.on("user-joined", (username) => {
    users.set(socket.id, username); // Add the user to the users map
    io.emit("update-user-list", [...users.values()]); // Broadcast updated user list
  });

  // Handle user sending changes in the editor
  socket.on("send-changes", ({ delta, username, position, lineContent }) => {
    const logMessage = `${new Date().toISOString()} - ${username} edited line at position ${position}: "${lineContent.trim()}"\n`;
    fs.appendFile("edit-history.txt", logMessage, (err) => {
      if (err) {
        console.error("Error writing to log file", err);
      }
    });

    socket.broadcast.emit("receive-changes", { delta, username, position, lineContent });
  });

  // Handle cursor changes
  socket.on("cursor-change", ({ range, username }) => {
    socket.broadcast.emit("receive-cursor", { range, username });
  });

  // Handle typing indicator
  socket.on("typing", (username) => {
    socket.broadcast.emit("user-typing", username);
  });

  // Handle user disconnecting
  socket.on("disconnect", () => {
    const username = users.get(socket.id);
    if (username) {
      users.delete(socket.id); // Remove user from the users map
      io.emit("update-user-list", [...users.values()]); // Broadcast updated user list
      console.log(`${username} disconnected`);
    }
  });
});

// Start the server
server.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});
