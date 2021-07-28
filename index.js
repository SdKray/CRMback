const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env' });

const conectarDB = require('./config/db');

// Conectar a la base de datos
conectarDB();
//servidor
const server = new ApolloServer({
	typeDefs,
	resolvers,
	context: ({ req }) => {
		// console.log('headers',req.headers)
		// console.log(req.headers['authorization'])
		const token = req.headers['authorization'] || '';
		if (token) {
			try {
				const usuario = jwt.verify(token.replace('Bearer ',''), process.env.SECRET_PASSWORD);
				// console.log(usuario)
				return {
					usuario,
				};

			} catch (error) {
				console.log(error);
			}
		}
	},
});

// Arranca el servidor.
server.listen().then(({ url }) => {
	console.log(`Servidor listo en la URL ${url}`);
});
