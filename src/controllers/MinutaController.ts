import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import {
  Conferencia,
  Pacote,
  Remessa,
  Minuta,
  Usuario,
  LogAuditoria
} from '../models';

export class MinutaController {
  // 1. Gerar Minuta de Transporte em PDF para uma Conferência
  static async gerar(req: Request, res: Response): Promise<void> {
    try {
      const conferenciaId = Number(req.params.conferencia_id || req.body.conferencia_id);
      const usuarioId = req.usuario?.id;

      if (isNaN(conferenciaId)) {
        res.status(400).json({ erro: 'ID da conferência inválido.' });
        return;
      }

      // Busca a conferência com todos os pacotes aprovados
      const conferencia = await Conferencia.findByPk(conferenciaId, {
        include: [
          {
            model: Usuario,
            as: 'usuario',
            attributes: ['id', 'nome', 'email']
          },
          {
            model: Remessa,
            as: 'remessas',
            include: [
              {
                model: Pacote,
                as: 'pacotes',
                where: {
                  status: ['ok', 'liberado_divergente']
                },
                required: false
              }
            ]
          }
        ]
      });

      if (!conferencia) {
        res.status(404).json({ erro: 'Conferência não encontrada.' });
        return;
      }

      // Coleta todos os pacotes conferidos de todas as remessas
      const remessas = (conferencia as any).remessas || [];
      const todosPacotes: Pacote[] = [];
      for (const r of remessas) {
        if (r.pacotes && Array.isArray(r.pacotes)) {
          todosPacotes.push(...r.pacotes);
        }
      }

      if (todosPacotes.length === 0) {
        res.status(400).json({
          erro: 'Não há pacotes conferidos e aprovados nesta conferência para gerar minuta.'
        });
        return;
      }

      // Gera código sequencial da minuta
      const timestamp = Date.now();
      const numeroMinuta = `MIN-${conferencia.id}-${timestamp.toString().slice(-6)}`;

      // Garante que o diretório de destino existe
      const storageDir = path.resolve(__dirname, '../../storage/minutas');
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      const nomeArquivo = `${numeroMinuta}.pdf`;
      const caminhoCompleto = path.join(storageDir, nomeArquivo);

      // Totais consolidados
      let pesoTotalGramas = 0;
      for (const p of todosPacotes) {
        pesoTotalGramas += Number(p.peso_lido_g || p.peso_esperado_g || 0);
      }
      const pesoTotalKg = (pesoTotalGramas / 1000).toFixed(2);

      // Criação do Documento PDF com PDFKit
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(caminhoCompleto);
      doc.pipe(stream);

      // --- CABEÇALHO ---
      doc.rect(40, 40, 515, 60).fill('#2e7d32');
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('EUROART LOGÍSTICA & EXPEDIÇÃO', 55, 52);
      doc.font('Helvetica').fontSize(11).text('ROMANEIO E MINUTA DE TRANSPORTE DE CARGA', 55, 73);
      doc.fontSize(10).text(`Nº: ${numeroMinuta}`, 420, 52, { align: 'right' });
      doc.fontSize(9).text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 420, 73, { align: 'right' });

      doc.moveDown(3);

      // --- DADOS DA CONFERÊNCIA ---
      doc.fillColor('#333333').fontSize(10);
      const conferenteNome = (conferencia as any).usuario?.nome || 'Operador Logístico';
      
      doc.font('Helvetica-Bold').text(`Transportadora: `, 45, 120, { continued: true });
      doc.font('Helvetica').text(conferencia.transportadora.toUpperCase());

      doc.font('Helvetica-Bold').text(`Conferente Responsável: `, 45, 135, { continued: true });
      doc.font('Helvetica').text(conferenteNome);

      doc.font('Helvetica-Bold').text(`Total de Volumes (Caixas): `, 350, 120, { continued: true });
      doc.font('Helvetica').text(`${todosPacotes.length} volume(s)`);

      doc.font('Helvetica-Bold').text(`Peso Total Aferido: `, 350, 135, { continued: true });
      doc.font('Helvetica').text(`${pesoTotalKg} kg`);

      doc.moveDown(1);
      doc.moveTo(40, 155).lineTo(555, 155).stroke('#cccccc');

      // --- TABELA DE PACOTES ---
      doc.moveDown(1);
      let y = 170;

      // Header da Tabela
      doc.rect(40, y, 515, 20).fill('#eceff1');
      doc.fillColor('#37474f').fontSize(9).font('Helvetica-Bold');
      doc.text('NF-e', 50, y + 5);
      doc.text('Chave de Acesso', 110, y + 5);
      doc.text('Destinatário', 280, y + 5);
      doc.text('UF', 420, y + 5);
      doc.text('Peso (g)', 460, y + 5);
      doc.text('Status', 510, y + 5);

      y += 24;
      doc.fillColor('#222222').fontSize(8).font('Helvetica');

      for (let i = 0; i < todosPacotes.length; i++) {
        const pacote = todosPacotes[i]!;

        // Quebra de página automática se necessário
        if (y > 680) {
          doc.addPage();
          y = 50;
        }

        // Fundo zebrado
        if (i % 2 === 1) {
          doc.rect(40, y - 2, 515, 16).fill('#f9fafb');
          doc.fillColor('#222222');
        }

        const nf = pacote.numero_nf || 'S/N';
        const chaveResumo = `${pacote.chave_acesso.slice(0, 6)}...${pacote.chave_acesso.slice(-8)}`;
        const destinatario = (pacote.razao_social || 'Cliente Balcão').slice(0, 24);
        const uf = pacote.uf || '--';
        const peso = Number(pacote.peso_lido_g || pacote.peso_esperado_g || 0).toFixed(0);
        const statusLabel = pacote.status === 'liberado_divergente' ? 'LIB' : 'OK';

        doc.text(nf, 50, y);
        doc.text(chaveResumo, 110, y);
        doc.text(destinatario, 280, y);
        doc.text(uf, 420, y);
        doc.text(`${peso} g`, 460, y);
        doc.text(statusLabel, 515, y);

        y += 18;
      }

      // --- TERMO DE RESPONSABILIDADE & ASSINATURAS ---
      y = Math.max(y + 30, 680);
      if (y > 720) {
        doc.addPage();
        y = 680;
      }

      doc.moveTo(40, y).lineTo(555, y).stroke('#cccccc');
      doc.fontSize(8).fillColor('#666666').text(
        'Declaramos que os volumes relacionados nesta minuta foram devidamente conferidos, pesados e inspecionados, sendo liberados para trânsito logístico.',
        40,
        y + 10,
        { width: 515, align: 'center' }
      );

      const signY = y + 55;
      doc.moveTo(60, signY).lineTo(250, signY).stroke('#444444');
      doc.fontSize(8).fillColor('#333333').text('Assinatura da Expedição (Euroart)', 70, signY + 5);

      doc.moveTo(330, signY).lineTo(520, signY).stroke('#444444');
      doc.fontSize(8).fillColor('#333333').text('Assinatura do Motorista / Transportadora', 335, signY + 5);

      doc.end();

      // Aguarda finalizar a gravação do PDF no disco
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      // Registra a minuta no banco de dados
      const novaMinuta = await Minuta.create({
        numero_minuta: numeroMinuta,
        conferencia_id: conferencia.id,
        caminho_arquivo: caminhoCompleto,
        data_emissao: new Date()
      });

      await LogAuditoria.create({
        usuario_id: usuarioId ?? null,
        acao: 'EMISSAO_MINUTA',
        detalhes: `Minuta ${numeroMinuta} gerada em PDF para conferência ${conferencia.id} (${todosPacotes.length} volumes, ${pesoTotalKg} kg).`
      });

      res.status(201).json({
        sucesso: true,
        mensagem: 'Minuta de transporte gerada com sucesso!',
        minuta: {
          id: novaMinuta.id,
          numero_minuta: novaMinuta.numero_minuta,
          conferencia_id: novaMinuta.conferencia_id,
          total_volumes: todosPacotes.length,
          peso_total_kg: Number(pesoTotalKg),
          caminho_arquivo: caminhoCompleto,
          data_emissao: novaMinuta.data_emissao
        }
      });
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao gerar minuta de transporte.' });
    }
  }

  // 2. Download do PDF da Minuta
  static async download(req: Request, res: Response): Promise<void> {
    try {
      const minutaId = Number(req.params.id);

      if (isNaN(minutaId)) {
        res.status(400).json({ erro: 'ID da minuta inválido.' });
        return;
      }

      const minuta = await Minuta.findByPk(minutaId);
      if (!minuta || !minuta.caminho_arquivo) {
        res.status(404).json({ erro: 'Minuta não encontrada.' });
        return;
      }

      if (!fs.existsSync(minuta.caminho_arquivo)) {
        res.status(404).json({ erro: 'Arquivo PDF da minuta não encontrado no servidor.' });
        return;
      }

      res.download(minuta.caminho_arquivo, `${minuta.numero_minuta}.pdf`);
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao realizar download da minuta.' });
    }
  }

  // 3. Listar Minutas emitidas para uma Conferência
  static async listarPorConferencia(req: Request, res: Response): Promise<void> {
    try {
      const conferenciaId = Number(req.params.conferencia_id);

      if (isNaN(conferenciaId)) {
        res.status(400).json({ erro: 'ID da conferência inválido.' });
        return;
      }

      const minutas = await Minuta.findAll({
        where: { conferencia_id: conferenciaId },
        order: [['id', 'DESC']]
      });

      res.status(200).json(minutas);
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao listar minutas da conferência.' });
    }
  }
}
