import { Router } from 'express';
import { RemessaController } from '../controllers/RemessaController';
import { verificarToken } from '../middlewares/auth';

const router = Router();

// Todas as rotas de remessa exigem autenticação
router.use(verificarToken);

// Importação de remessas e notas fiscais em JSON
router.post('/importar', RemessaController.importar);

// Listar remessas de uma conferência
router.get('/conferencia/:conferencia_id', RemessaController.listarPorConferencia);

// Reversão / exclusão de uma remessa
router.delete('/:id', RemessaController.excluir);

export default router;
