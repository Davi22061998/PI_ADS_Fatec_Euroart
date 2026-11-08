import { Router } from 'express';
import { MinutaController } from '../controllers/MinutaController';
import { verificarToken } from '../middlewares/auth';

const router = Router();

// Todas as rotas de minutas exigem autenticação
router.use(verificarToken);

// Gerar minuta de transporte em PDF para uma conferência
router.post('/gerar/:conferencia_id', MinutaController.gerar);

// Download do arquivo PDF gerado
router.get('/:id/download', MinutaController.download);

// Listar minutas de uma conferência
router.get('/conferencia/:conferencia_id', MinutaController.listarPorConferencia);

export default router;
