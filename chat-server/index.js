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
  console.log('New connection established:', socket.id);
  let currentRoom = null;

  socket.on('join', (username) => {
    console.log(`User ${username} attempting to join`);
    currentRoom = findAvailableRoom();
    socket.join(currentRoom);
    rooms.get(currentRoom).users.add(username);
    
    console.log(`User ${username} joined room ${currentRoom}`);
    
    // Send room number to the client
    socket.emit('room info', currentRoom);
    
    // Send system message about user joining
    const joinMessage = {
      user: 'System',
      text: `${username} has entered the room`,
      timestamp: Date.now(),
      isSystemMessage: true
    };
    rooms.get(currentRoom).messages.push(joinMessage);
    io.to(currentRoom).emit('new message', joinMessage);
    
    // Send last minute of messages to the user
    const oneMinuteAgo = Date.now() - 60000;
    const recentMessages = rooms.get(currentRoom).messages.filter(msg => msg.timestamp > oneMinuteAgo);
    console.log(`Sending chat history to ${username}:`, recentMessages);
    socket.emit('chat history', recentMessages);
  });

  socket.on('new message', (msg) => {
    console.log('New message received:', msg);
    if (!currentRoom) {
      console.log('Error: Message received but user not in a room');
      return;
    }
    
    const messageData = {
      user: msg.user,
      text: msg.text,
      timestamp: Date.now(),
      isSystemMessage: false
    };
    rooms.get(currentRoom).messages.push(messageData);
    console.log(`Broadcasting message to room ${currentRoom}:`, messageData);
    io.to(currentRoom).emit('new message', messageData);
    
    // Set timeout to delete message after 60 seconds
    setTimeout(() => {
      const index = rooms.get(currentRoom).messages.findIndex(m => m.timestamp === messageData.timestamp);
      if (index !== -1) {
        rooms.get(currentRoom).messages.splice(index, 1);
        console.log(`Deleting message in room ${currentRoom}:`, messageData);
        io.to(currentRoom).emit('delete message', messageData.timestamp);
      }
    }, 60000);
  });

  socket.on('leave', (username) => {
    console.log(`User ${username} leaving`);
    if (currentRoom) {
      rooms.get(currentRoom).users.delete(username);
      
      // Send system message about user leaving
      const leaveMessage = {
        user: 'System',
        text: `${username} has left the room`,
        timestamp: Date.now(),
        isSystemMessage: true
      };
      rooms.get(currentRoom).messages.push(leaveMessage);
      io.to(currentRoom).emit('new message', leaveMessage);
      
      if (rooms.get(currentRoom).users.size === 0) {
        console.log(`Closing empty room ${currentRoom}`);
        rooms.delete(currentRoom);
      }
      
      socket.leave(currentRoom);
      currentRoom = null;
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`);
    if (currentRoom) {
      const username = Array.from(rooms.get(currentRoom).users).find(user => 
        io.sockets.adapter.rooms.get(currentRoom).has(socket.id)
      );
      if (username) {
        console.log(`User ${username} disconnected from room ${currentRoom}`);
        rooms.get(currentRoom).users.delete(username);
        
        // Send system message about user disconnecting
        const disconnectMessage = {
          user: 'System',
          text: `${username} has left the conversation`,
          timestamp: Date.now(),
          isSystemMessage: true
        };
        rooms.get(currentRoom).messages.push(disconnectMessage);
        io.to(currentRoom).emit('new message', disconnectMessage);
        
        if (rooms.get(currentRoom).users.size === 0) {
          console.log(`Closing empty room ${currentRoom}`);
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