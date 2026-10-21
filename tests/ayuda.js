// Base de pruebas: cada archivo de pruebas usa su propia base y la borra al terminar.
const { MongoClient } = require('mongodb');
const { cargar } = require('../scripts/cargar-datos');

async function baseDePrueba(nombre) {
  const cliente = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await cliente.connect();
  const db = cliente.db(`vinoteca_test_${nombre}`);
  await db.dropDatabase();
  await cargar(db, { cantidadClientes: 6, cantidadPedidos: 20 });
  return {
    db,
    async cerrar() {
      await db.dropDatabase();
      await cliente.close();
    },
  };
}

module.exports = { baseDePrueba };
