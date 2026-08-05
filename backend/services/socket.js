let io = null

function init(httpServer) {
  const { Server } = require('socket.io')
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  })
  io.on('connection', (socket) => {
    console.log('[socket] cliente conectado:', socket.id)
    socket.on('disconnect', () => {
      console.log('[socket] cliente desconectado:', socket.id)
    })
  })
  return io
}

function emitEvent(event, data) {
  if (io) io.emit(event, data)
}

function getIO() {
  return io
}

module.exports = { init, emitEvent, getIO }
