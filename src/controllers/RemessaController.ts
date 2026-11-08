import { Request, Response } from 'express';
import {
  sequelize,
  Remessa,
  Pacote,
  ItemPacote,
  Produto,
  Embalagem,
  RegraIcms,
  Conferencia,
  LogAuditoria
} from '../models';

export interface ItemImportacaoDTO {
  codigo_sku: string;
  quantidade: number;
  descricao?: string;
}

export interface PacoteImportacaoDTO {
  chave_acesso: string;
  numero_nf?: string;
  razao_social?: string;
  descricao_produto?: string;
  uf?: string;
  codigo_caixa?: string;
  itens?: ItemImportacaoDTO[];
}

export class RemessaController {
  // 1. Importação de lote de Notas Fiscais / Pacotes (JSON)
  static async importar(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { conferencia_id, mkp, pacotes } = req.body;
      const usuarioId = req.usuario?.id;

      if (!conferencia_id) {
        await transaction.rollback();
        res.status(400).json({ erro: 'O ID da conferência é obrigatório.' });
        return;
      }

      if (!pacotes || !Array.isArray(pacotes) || pacotes.length === 0) {
        await transaction.rollback();
        res.status(400).json({ erro: 'O lote deve conter pelo menos um pacote para importação.' });
        return;
      }

      // Valida se a conferência existe e está ativa
      const conferencia = await Conferencia.findByPk(conferencia_id, { transaction });
      if (!conferencia) {
        await transaction.rollback();
        res.status(404).json({ erro: 'Conferência informada não encontrada.' });
        return;
      }

      if (conferencia.status !== 'em_andamento') {
        await transaction.rollback();
        res.status(400).json({ erro: 'Só é possível importar remessas para conferências em andamento.' });
        return;
      }

      // Cria a Remessa no banco
      const novaRemessa = await Remessa.create(
        {
          conferencia_id: Number(conferencia_id),
          mkp: mkp || 'Importação Manual JSON',
          data_importacao: new Date()
        },
        { transaction }
      );

      // Cache de embalagens e regras ICMS para desempenho
      const todasEmbalagens = await Embalagem.findAll({ transaction });
      const embalagensMap = new Map<string, Embalagem>();
      for (const emb of todasEmbalagens) {
        embalagensMap.set(emb.tipo.toUpperCase(), emb);
      }

      const todasRegrasIcms = await RegraIcms.findAll({ transaction });
      const icmsMap = new Map<string, boolean>();
      for (const r of todasRegrasIcms) {
        icmsMap.set(r.uf.toUpperCase(), r.exige_guia);
      }

      // Cache de produtos
      const todosProdutos = await Produto.findAll({ transaction });
      const produtosMap = new Map<string, Produto>();
      for (const prod of todosProdutos) {
        produtosMap.set(prod.sku.toUpperCase(), prod);
      }

      let totalPacotesComIcms = 0;
      const pacotesCriados: Pacote[] = [];

      for (const p of pacotes as PacoteImportacaoDTO[]) {
        if (!p.chave_acesso) {
          throw new Error('Todo pacote deve possuir uma chave de acesso.');
        }

        const ufDestino = p.uf ? p.uf.toUpperCase() : null;
        const exigeIcms = ufDestino ? (icmsMap.get(ufDestino) ?? false) : false;
        if (exigeIcms) totalPacotesComIcms++;

        // Obter embalagem e tara
        let caixaId: number | null = null;
        let taraGramas = 0;
        if (p.codigo_caixa) {
          const emb = embalagensMap.get(p.codigo_caixa.toUpperCase());
          if (emb) {
            caixaId = emb.id;
            taraGramas = Number(emb.peso_estimado_g);
          }
        }

        // Calcular peso esperado baseado nos itens
        let pesoItens = 0;
        const itensValidados: { produto_id: number; quantidade: number }[] = [];

        if (p.itens && Array.isArray(p.itens)) {
          for (const item of p.itens) {
            const produto = produtosMap.get(item.codigo_sku.toUpperCase());
            const qtd = Number(item.quantidade) || 1;
            if (produto) {
              pesoItens += Number(produto.peso_unitario_g) * qtd;
              itensValidados.push({ produto_id: produto.id, quantidade: qtd });
            }
          }
        }

        const pesoEsperadoFinal = taraGramas + pesoItens;

        const novoPacote = await Pacote.create(
          {
            chave_acesso: p.chave_acesso.trim(),
            remessa_id: novaRemessa.id,
            numero_nf: p.numero_nf || null,
            razao_social: p.razao_social || null,
            descricao_produto: p.descricao_produto || null,
            uf: ufDestino,
            status: 'pendente',
            possui_guia_icms: exigeIcms,
            peso_esperado_g: pesoEsperadoFinal > 0 ? pesoEsperadoFinal : null,
            caixa_id: caixaId,
            tentativas_peso: 0
          },
          { transaction }
        );

        // Cria os itens vinculados ao pacote
        for (const item of itensValidados) {
          await ItemPacote.create(
            {
              pacote_id: novoPacote.id,
              produto_id: item.produto_id,
              quantidade: item.quantidade
            },
            { transaction }
          );
        }

        pacotesCriados.push(novoPacote);
      }

      await LogAuditoria.create(
        {
          usuario_id: usuarioId ?? null,
          acao: 'IMPORTACAO_REMESSA',
          detalhes: `Remessa ID ${novaRemessa.id} importada com ${pacotesCriados.length} pacotes para a conferência ${conferencia_id}.`
        },
        { transaction }
      );

      await transaction.commit();

      res.status(201).json({
        sucesso: true,
        mensagem: 'Lote de remessa importado com sucesso!',
        dados: {
          remessa_id: novaRemessa.id,
          conferencia_id: novaRemessa.conferencia_id,
          total_pacotes: pacotesCriados.length,
          total_pacotes_com_guia_icms: totalPacotesComIcms
        }
      });
    } catch (error: any) {
      await transaction.rollback();
      res.status(500).json({ erro: error.message || 'Erro ao processar importação da remessa.' });
    }
  }

  // 2. Listar remessas de uma conferência com contagem de pacotes
  static async listarPorConferencia(req: Request, res: Response): Promise<void> {
    try {
      const conferenciaId = Number(req.params.conferencia_id);

      if (isNaN(conferenciaId)) {
        res.status(400).json({ erro: 'ID da conferência inválido.' });
        return;
      }

      const remessas = await Remessa.findAll({
        where: { conferencia_id: conferenciaId },
        include: [
          {
            model: Pacote,
            as: 'pacotes',
            attributes: ['id', 'status', 'possui_guia_icms', 'peso_esperado_g', 'peso_lido_g']
          }
        ],
        order: [['id', 'DESC']]
      });

      res.status(200).json(remessas);
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao listar remessas.' });
    }
  }

  // 3. Reversão / Exclusão de remessa importada incorretamente
  static async excluir(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const remessaId = Number(req.params.id);
      const usuarioId = req.usuario?.id;

      if (isNaN(remessaId)) {
        await transaction.rollback();
        res.status(400).json({ erro: 'ID da remessa inválido.' });
        return;
      }

      const remessa = await Remessa.findByPk(remessaId, {
        include: [{ model: Pacote, as: 'pacotes' }],
        transaction
      });

      if (!remessa) {
        await transaction.rollback();
        res.status(404).json({ erro: 'Remessa não encontrada.' });
        return;
      }

      const pacotes = (remessa as any).pacotes || [];
      const totalPacotes = pacotes.length;

      // Deleta itens dos pacotes
      for (const p of pacotes) {
        await ItemPacote.destroy({ where: { pacote_id: p.id }, transaction });
      }

      // Deleta pacotes
      await Pacote.destroy({ where: { remessa_id: remessaId }, transaction });

      // Deleta a remessa
      await remessa.destroy({ transaction });

      await LogAuditoria.create(
        {
          usuario_id: usuarioId ?? null,
          acao: 'REVERSAO_REMESSA',
          detalhes: `Remessa ID ${remessaId} revertida/excluída (${totalPacotes} pacotes removidos).`
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        sucesso: true,
        mensagem: `Remessa ID ${remessaId} revertida com sucesso. ${totalPacotes} pacotes foram removidos.`
      });
    } catch (error: any) {
      await transaction.rollback();
      res.status(500).json({ erro: error.message || 'Erro ao reverter remessa.' });
    }
  }
}
