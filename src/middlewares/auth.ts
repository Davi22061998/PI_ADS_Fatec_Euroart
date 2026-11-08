import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface UsuarioTokenPayload {
  id: number;
  nome: string;
  email: string;
  perfil: 'admin' | 'conferente';
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioTokenPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'euroart_secret_key_default';

export function verificarToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ erro: 'Token de autenticação não fornecido.' });
    return;
  }

  const partes = authHeader.split(' ');
  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    res.status(401).json({ erro: 'Formato de token inválido. Use Bearer <token>.' });
    return;
  }

  const token = partes[1];

  try {
    const payload = jwt.verify(token as string, JWT_SECRET) as UsuarioTokenPayload;
    req.usuario = payload;
    next();
  } catch (error) {
    res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

export function apenasAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.usuario) {
    res.status(401).json({ erro: 'Usuário não autenticado.' });
    return;
  }

  if (req.usuario.perfil !== 'admin') {
    res.status(403).json({ erro: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
    return;
  }

  next();
}
