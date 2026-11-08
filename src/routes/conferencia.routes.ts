import { Router } from 'express';
import { ConferenciaController } from '../controllers/ConferenciaController';
import { verificarToken, apenasAdmin } from '../middlewares/auth';

const router = Router();

// Todas as rotas de conferência exigem autenticação via JWT
router.use(verificarToken);

// Listar conferências ativas (em andamento)
router.get('/ativas', ConferenciaController.listarAtivas);

// Iniciar nova conferência para uma transportadora
router.post('/iniciar', ConferenciaController.iniciar);

// Rota principal de bipagem IoT (Chave de Acesso + Balança)
router.post('/bipar', ConferenciaController.bipar);

// Liberação de pacote com divergência/bloqueio (Apenas Admin)
router.post('/pacotes/:id/liberar', apenasAdmin, ConferenciaController.liberarPacote);

// Finalizar conferência
router.post('/:id/finalizar', ConferenciaController.finalizar);

export default router;
