const { MongoClient } = require('mongodb');
const config = require('../config');

let cliente = null;
let base = null;

/** Conecta una sola vez y reutiliza el mismo cliente (el driver ya maneja un pool de conexiones). */
async function conectar(nombreBase = config.baseDatos, uri = config.mongoUri) {
  if (base && base.databaseName === nombreBase) return base;
  if (!cliente) {
    cliente = new MongoClient(uri);
    await cliente.connect();
  }
  base = cliente.db(nombreBase);
  return base;
}

function obtenerBase() {
  if (!base) throw new Error('La base de datos no está conectada. Llamá primero a conectar().');
  return base;
}

async function desconectar() {
  if (cliente) await cliente.close();
  cliente = null;
  base = null;
}

module.exports = { conectar, obtenerBase, desconectar };
