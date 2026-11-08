import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import sequelize from './config/database';
import './models';
import authRoutes from './routes/auth.routes';
import usuarioRoutes from './routes/usuario.routes';
import conferenciaRoutes from './routes/conferencia.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares essenciais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend (public/)
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/conferencias', conferenciaRoutes);

// Rota de verificação de integridade da API
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Redirecionamento da raiz para a tela de login
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'login.html'));
});

// Inicialização do servidor e validação da conexão com o banco de dados
async function iniciarServidor() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso.');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor Euroart rodando na porta ${PORT}`);
      console.log(`🌐 Interface web: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Falha ao conectar ao banco de dados:', error);
    // Inicia o servidor mesmo que o banco esteja temporariamente offline para servir estáticos/erros informativos
    app.listen(PORT, () => {
      console.log(`⚠️ Servidor iniciado na porta ${PORT}, mas sem conexão ativa com o banco.`);
    });
  }
}

iniciarServidor();

export default app;
