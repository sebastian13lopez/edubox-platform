const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Módulos nuevos para WebSockets
const http = require('http'); 
const { Server } = require('socket.io'); 
const Message = require('./models/Message'); // Requerimos el modelo para guardar chats

const app = express();

// --- Envolver Express en un Servidor HTTP nativo ---
const server = http.createServer(app);

// --- Configurar Socket.IO con CORS para Angular ---
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:4200', 
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// ==========================================
// 1. ENRUTAMIENTO REST (El Menú del Restaurante)
// ==========================================
// Aquí conectamos las URLs que Angular va a consumir con los archivos lógicos de la DB
app.use('/api/auth', require('./routes/auth'));           // Manejo de JWT (Login/Registro)
app.use('/api/usuarios', require('./routes/usuarios'));   // CRUD Usuarios
app.use('/api/cursos', require('./routes/cursos'));       // CRUD Cursos
app.use('/api/historial', require('./routes/historial')); // Guardado de la transcripción IA

// ==========================================
// 2. CONEXIÓN A MONGODB (La Despensa)
// ==========================================
// Mongoose traduce la DB NoSQL para poder manejarla como Objetos Javascript
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🟢 ¡Conectado a la base de datos de Voxera en MongoDB Atlas!'))
  .catch((error) => console.error('🔴 Error conectando a MongoDB:', error));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de Voxera funcionando correctamente.');
});

// ==========================================
// 3. LÓGICA DE WEBSOCKETS (Chat y Presencia Real-Time)
// ==========================================
// Los websockets mantienen una tubería TCP abierta bi-direccional.

// Registro temporal en memoria RAM: { cursoId: [ { socketId, idUsuario, nombre, rol }, ... ] }
const usuariosPorClase = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Nuevo cliente conectado (Túnel TCP Abierto):', socket.id);

  // --- EVENTO: Unirse a la Clase / Aula ---
  socket.on('unirse-clase', ({ cursoId, usuario }) => {
    // socket.join() aísla el broadcast a este curso único (Cuarto privado)
    socket.join(cursoId);
    
    // Almacenamos en el socket su estado actual para poder borrarlo cuando se desconecte
    socket.cursoActual = cursoId;
    socket.usuarioActual = usuario;

    // Inicializar el array de la sala si no existe
    if (!usuariosPorClase.has(cursoId)) {
      usuariosPorClase.set(cursoId, []);
    }
    const usuariosSala = usuariosPorClase.get(cursoId);
    
    // Evitar duplicados por si recarga la página
    const existe = usuariosSala.find(u => u.idUsuario === usuario.idUsuario);
    if (!existe) {
      usuariosSala.push({ socketId: socket.id, ...usuario });
    }

    // Emitir a toda la sala la lista nueva de participantes
    io.to(cursoId).emit('lista-usuarios-actualizada', usuariosSala);
    console.log(`👤 ${usuario.nombre} se unió al aula ${cursoId}`);
  });

  // --- EVENTO: Enviar Mensaje en el Chat ---
  socket.on('enviar-mensaje', async ({ cursoId, autor_id, texto, nombreAutor }) => {
    try {
        // Guardamos el mensaje permanentemente en MongoDB
        const nuevoMensaje = new Message({
            curso_id: cursoId,
            autor_id: autor_id,
            texto: texto
        });
        await nuevoMensaje.save();

        // Emitimos a la sala (usar socket.to impide que el mensaje doble rebote al creador original)
        socket.to(cursoId).emit('nuevo-mensaje', {
            _id: nuevoMensaje._id,
            curso_id: cursoId,
            autor_id: autor_id,
            autor: nombreAutor, // Frontend usa 'autor', no 'nombreAutor'
            texto: texto,
            createdAt: nuevoMensaje.createdAt
        });
    } catch(error) {
        console.error('Error enviando y guardando mensaje:', error);
    }
  });

  // 3. Desconexión al cerrar la pestaña o el aula
  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado:', socket.id);
    
    const cursoId = socket.cursoActual;
    const usuario = socket.usuarioActual;

    if (cursoId && usuariosPorClase.has(cursoId)) {
      let usuariosSala = usuariosPorClase.get(cursoId);
      
      // Filtramos la lista sacando al socket que se desconectó
      usuariosSala = usuariosSala.filter(u => u.socketId !== socket.id);
      usuariosPorClase.set(cursoId, usuariosSala);

      // Si la sala está vacía, limpiamos la memoria
      if (usuariosSala.length === 0) {
        usuariosPorClase.delete(cursoId);
      } else {
        // Notificamos a los restantes que alguien se fue
        io.to(cursoId).emit('lista-usuarios-actualizada', usuariosSala);
      }

      if(usuario) {
        console.log(`🚪 ${usuario.nombre} salió del aula ${cursoId}`);
      }
    }
  });

  // 4. Transmisión en Tiempo Real de Voz a Texto
  socket.on('transmision-texto', ({ cursoId, textos }) => {
    console.log(`🎙️ Recibiendo textos para el curso ${cursoId}:`, textos.length, 'bloques.');
    // Rebota los fragmentos transcritos de la IA a toda el aula instantáneamente
    socket.to(cursoId).emit('actualizacion-transcripcion', textos);
  });

  socket.on('transmision-interim', ({ cursoId, interimText }) => {
    socket.to(cursoId).emit('actualizacion-interim', interimText);
  });
});


// === Iniciar servidor ===
// ATENCIÓN: Ahora usamos server.listen, no app.listen para acoplar sockets y HTTP API a la vez
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP/Socket.IO corriendo en el puerto ${PORT}`);
});