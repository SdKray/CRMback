const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Clientes = require('../models/Cliente');
const Pedido = require('../models/Pedido');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: 'variables.env' });

const crearToken = (usuario, secreta, expiresIn) => {
	const { id, email, nombre, apellido } = usuario;
	return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

// Resolvers

const resolvers = {
	Query: {
		obtenerUsuario: async (_, {}, ctx) => {
			return ctx.usuario;
		},
		obtenerProductos: async () => {
			try {
				const productos = await Producto.find();
				return productos;
			} catch (error) {
				console.log(error);
			}
		},
		obtenerProducto: async (_, { id }) => {
			//Revisar si el producto existe
			const producto = await Producto.findById(id);
			if (!producto) {
				throw new Error('El producto no existe ');
			}
			return producto;
		},
		obtenerClientes: async () => {
			try {
				const clientes = await Clientes.find({});
				return clientes;
			} catch (error) {
				console.log(error);
			}
		},
		obtenerClientesVendedor: async (_, {}, ctx) => {
			try {
				const clientes = await Clientes.find({
					vendedor: ctx.usuario.id.toString(),
				});
				return clientes;
			} catch (error) {
				console.log(error);
			}
		},
		obtenerCliente: async (_, { id }, ctx) => {
			//Revisar si el cliente existe o no
			const cliente = await Clientes.findById(id);
			console.log(!cliente);
			if (!cliente) {
				throw new Error('Cliente no encontrado');
			}
			//Quien lo creo puede verlo
			if (cliente.vendedor.toString() !== ctx.usuario.id) {
				throw new Error('No tienes las credenciales');
			}
			return cliente;
		},
		obtenerPedidos: async () => {
			try {
				const pedidos = await Pedido.find({});
				return pedidos;
			} catch (error) {
				console.log(error);
			}
		},
		obtenerPedidosVendedor: async (_, {}, ctx) => {
			try {
				const pedidos = await Pedido.find({ vendedor: ctx.usuario.id }).populate('cliente');
				console.log(pedidos)
				return pedidos;
			} catch (error) {
				console.log(error);
			}
		},
		obtenerPedido: async (_, { id }, ctx) => {
			//Si el pedido existes o no
			const pedido = await Pedido.findById(id);
			if (!pedido) {
				throw new Error('Pedido no encontrado');
			}
			//Solo quien lo creo puede verlo
			if (pedido.vendedor.toString() !== ctx.usuario.id) {
				throw new Error('No tienes las credenciales');
			}

			return pedido;
		},
		obtenerPedidosEstado: async (_, { estado }, ctx) => {
			const pedidos = await Pedido.find({ vendedor: ctx.usuario.id, estado });
			return pedidos;
		},
		mejoresClientes: async () => {
			const clientes = await Pedido.aggregate([
				{ $match: { estado: 'COMPLETADO' } },
				{ $group: { _id: '$cliente', total: { $sum: '$total' } } },
				{
					$lookup: {
						from: 'clientes',
						localField: '_id',
						foreignField: '_id',
						as: 'cliente',
					},
				},
				{
					$sort: {
						total: -1,
					},
				},
			]);
			return clientes;
		},
		mejoresVendedores: async () => {
			const vendedores = await Pedido.aggregate([
				{ $match: { estado: 'COMPLETADO' } },
				{ $group: { _id: '$vendedor', total: { $sum: '$total' } } },
				{
					$lookup: {
						from: 'usuarios',
						localField: '_id',
						foreignField: '_id',
						as: 'vendedor',
					},
				},
				{
					$sort: {
						total: -1,
					},
				},
			]);
			return vendedores;
		},
		buscarProducto: async (_, { texto }) => {
			const producto = await Producto.find({ $text: { $search: texto } });
			return producto;
		},
	},
	Mutation: {
		nuevoUsuario: async (_, { input }) => {
			const { email, password } = input;
			// Revisar si el usuario  ya esta registrado
			const existeUsuario = await Usuario.findOne({ email });
			if (existeUsuario) {
				throw new Error('El usuario ya esta registrado');
			}
			//TODO: Hashear el passoword
			const salt = await bcryptjs.genSalt(10);
			input.password = await bcryptjs.hash(password, salt);
			//TODO: Guardarlo en la base de datos
			try {
				const usuario = new Usuario(input);
				usuario.save(); //Guardado
				return usuario;
			} catch (error) {
				console.log(error);
			}
			return 'Creando...';
		},
		autenticarUsuario: async (_, { input }) => {
			const { email, password } = input;
			//TODO: Si el usuario existe
			const existeUsuario = await Usuario.findOne({ email });
			if (!existeUsuario) {
				throw new Error('El usuario no existe');
			}
			//TODO: Revisar si el passowrd es correcto
			const passwordCorrecto = await bcryptjs.compare(
				password,
				existeUsuario.password
			);
			if (!passwordCorrecto) {
				throw new Error('El password no es correcto');
			}
			//Crear el token
			return {
				token: crearToken(existeUsuario, process.env.SECRET_PASSWORD, '24h'),
			};
		},
		nuevoProducto: async (_, { input }) => {
			try {
				const producto = new Producto(input);

				//almacenar en la bd
				const resultado = await producto.save();
				return resultado;
			} catch (error) {
				throw new Error('Error');
			}
		},
		actualizarProducto: async (_, { id, input }) => {
			let producto = await Producto.findById(id);
			if (!producto) {
				throw new Error('El producto no existe ');
			}
			producto = await Producto.findOneAndUpdate({ _id: id }, input, {
				new: true,
			});
			return producto;
		},
		eliminarProducto: async (_, { id }) => {
			let producto = await Producto.findById(id);
			if (!producto) {
				throw new Error('El producto no existe');
			}
			//eliminar
			await Producto.findOneAndDelete({ _id: id });
			return 'Producto eliminado';
		},
		nuevoCliente: async (_, { input }, ctx) => {
			const { email } = input;

			//Verificar si el cliente ya esta registrado
			const cliente = await Clientes.findOne({ email });

			//
			if (cliente) {
				throw new Error('Cliente ya registrado');
			}
			const nuevoCliente = new Clientes(input);
			nuevoCliente.vendedor = ctx.usuario.id;
			try {
				const resultado = await nuevoCliente.save();
				return resultado;
			} catch (error) {
				console.log(error);
			}
		},
		actualizarCliente: async (_, { id, input }, ctx) => {
			//Verificar si existe o no
			let cliente = await Clientes.findById(id);
			if (!cliente) {
				throw new Error('Ese cliente no existe');
			}
			//Verificar si el vendedor es quien lo modifica
			if (cliente.vendedor.toString() !== ctx.usuario.id) {
				throw new Error('No tienes las credenciales');
			}
			//Guardar
			cliente = await Clientes.findByIdAndUpdate({ _id: id }, input, {
				new: true,
			});
			return cliente;
		},
		eliminarCliente: async (_, { id }, ctx) => {
			//Verificar si existe o no
			let cliente = await Clientes.findById(id);
			if (!cliente) {
				throw new Error('Ese cliente no existe');
			}
			//Verificar si el vendedor es quien lo modifica
			if (cliente.vendedor.toString() !== ctx.usuario.id) {
				throw new Error('No tienes las credenciales');
			}
			//Eliminar Cliente
			await Clientes.findOneAndDelete({ _id: id });
			return 'Cliente Eliminado';
		},
		nuevoPedido: async (_, { input }, ctx) => {
			// * verificar si el cliente existe

			const { cliente } = input;

			// * verificar si el cliente es del vendedor

			let clienteExiste = await Clientes.findById(cliente);
			if (!clienteExiste) {
				throw new Error('Ese cliente no existe');
			}

			if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
				throw new Error('No tienes las credenciales');
			}
			// * Revisar el stock

			//input.pedido.forEach(async art => {
			for await (const art of input.pedido) {
				const { id } = art;
				const pro = await Producto.findById(id);
				if (art.cantidad > pro.existencia) {
					throw new Error(
						`El articulo: ${pro.nombre} excede la cantidad disponible`
					);
				} else {
					pro.existencia = pro.existencia - art.cantidad;
					await pro.save();
				}
			}
			// * crear un nuevo pedido
			const nuevoPedido = new Pedido(input);

			// * asiganar un vendedor

			nuevoPedido.vendedor = ctx.usuario.id;
			// * guardar
			const res = await nuevoPedido.save();
			return res;
		},
		actualizarPedido: async (_, { id, input }, ctx) => {
			const { cliente } = input;

			// si el pedido existe
			const existePedido = await Pedido.findById(id);
			if (!existePedido) {
				throw new Error('El pedido no existe');
			}
			// si el cliente existee
			const existeCliente = await Clientes.findById(cliente);
			if (!existeCliente) {
				throw new Error('El cliente no existe');
			}
			//Si el cliente y pedido pertenece al vendedor
			//Verificar si el vendedor es quien edita
			if (existeCliente.vendedor.toString() !== ctx.usuario.id) {
				throw new Error('No tienes las credenciales');
			}
			//Revisar el stock
			if (input.pedido) {
				for await (const art of input.pedido) {
					const { id } = art;
					const pro = await Producto.findById(id);
					if (art.cantidad > pro.existencia) {
						throw new Error(
							`El articulo: ${pro.nombre} excede la cantidad disponible`
						);
					} else {
						pro.existencia = pro.existencia - art.cantidad;
						await pro.save();
					}
				}
			}
			// Guardar el pedido
			const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, {
				new: true,
			});
			return resultado;
		},
		eliminarPedido: async (_, { id }, ctx) => {
			//verificar si el pedido existe
			const pedido = await Pedido.findById(id);
			if (!pedido) {
				throw new Error('El pedido no existe');
			}
			//verificar si el vendes es quien lo borra
			if (pedido.vendedor.toString() !== ctx.usuario.id) {
				throw new Error('No tienes las credenciales');
			}

			//eliminar de la base de datos

			await Pedido.findOneAndDelete({ _id: id });
			return 'Pedido eliminado';
		},
	},
};

module.exports = resolvers;
