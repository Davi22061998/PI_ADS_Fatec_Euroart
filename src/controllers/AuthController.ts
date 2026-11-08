import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario';
import { UsuarioTokenPayload } from '../middlewares/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'euroart_secret_key_default';

export class AuthController {
  // Verifica se o banco já possui usuários cadastrados (para modo de primeiro acesso/setup)
  static async checkSetup(_req: Request, res: Response): Promise<void> {
    try {
      const count = await Usuario.count();
      res.status(200).json({ hasUsers: count > 0 });
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao checar status do sistema.' });
    }
  }

  // Cadastro de setup inicial (primeiro administrador)
  static async registrar(req: Request, res: Response): Promise<void> {
    try {
      const count = await Usuario.count();
      if (count > 0) {
        res.status(403).json({ erro: 'O sistema já possui usuários cadastrados. Utilize a tela de login.' });
        return;
      }

      const { nome, email, senha } = req.body;
      if (!nome || !email || !senha) {
        res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
        return;
      }

      const senha_hash = await bcrypt.hash(senha, 10);
      const novoAdmin = await Usuario.create({
        nome,
        email,
        senha_hash,
        perfil: 'admin'
      });

      res.status(201).json({
        mensagem: 'Administrador configurado com sucesso!',
        usuario: {
          id: novoAdmin.id,
          nome: novoAdmin.nome,
          email: novoAdmin.email,
          perfil: novoAdmin.perfil
        }
      });
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao registrar administrador inicial.' });
    }
  }

  // Autenticação / Login
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
        return;
      }

      const usuario = await Usuario.findOne({ where: { email } });
      if (!usuario) {
        res.status(401).json({ erro: 'Credenciais inválidas.' });
        return;
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
      if (!senhaValida) {
        res.status(401).json({ erro: 'Credenciais inválidas.' });
        return;
      }

      const payload: UsuarioTokenPayload = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

      res.status(200).json({
        mensagem: 'Login realizado com sucesso!',
        token,
        usuario: payload
      });
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao processar login.' });
    }
  }
}
