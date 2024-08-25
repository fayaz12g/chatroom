const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let rooms = new Map();

function createRoom() {
  return {
    messages: [],
    users: new Set(),
  };
}

function findAvailableRoom() {
  for (let [roomId, room] of rooms) {
    if (room.users.size < 3) {
      return roomId;
    }
  }
  const newRoomId = `room-${rooms.size + 1}`;
  rooms.set(newRoomId, createRoom());
  return newRoomId;
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join', (username) => {
    currentRoom = findAvailableRoom();
    socket.join(currentRoom);
    rooms.get(currentRoom).users.add(username);
    
    io.to(currentRoom).emit('user joined', `${username} has entered the conversation`);
    
    // Send last 10 messages to the user
    socket.emit('chat history', rooms.get(currentRoom).messages.slice(-10));
  });

  socket.on('new message', (msg) => {
    if (!currentRoom) return;
    
    const messageData = {
      user: msg.user,
      text: msg.text,
      timestamp: Date.now(),
    };
    rooms.get(currentRoom).messages.push(messageData);
    io.to(currentRoom).emit('new message', messageData);
    
    // Set timeout to delete message after 60 seconds
    setTimeout(() => {
      const index = rooms.get(currentRoom).messages.findIndex(m => m.timestamp === messageData.timestamp);
      if (index !== -1) {
        rooms.get(currentRoom).messages.splice(index, 1);
        io.to(currentRoom).emit('delete message', messageData.timestamp);
      }
    }, 60000);
  });

  socket.on('leave', (username) => {
    if (currentRoom) {
      rooms.get(currentRoom).users.delete(username);
      io.to(currentRoom).emit('user left', `${username} has left the conversation`);
      
      if (rooms.get(currentRoom).users.size === 0) {
        rooms.delete(currentRoom);
      }
      
      socket.leave(currentRoom);
      currentRoom = null;
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const username = Array.from(rooms.get(currentRoom).users).find(user => 
        io.sockets.adapter.rooms.get(currentRoom).has(socket.id)
      );
      if (username) {
        rooms.get(currentRoom).users.delete(username);
        io.to(currentRoom).emit('user left', `${username} has left the conversation`);
        
        if (rooms.get(currentRoom).users.size === 0) {
          rooms.delete(currentRoom);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});