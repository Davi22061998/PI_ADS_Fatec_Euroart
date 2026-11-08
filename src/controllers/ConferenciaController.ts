import { Request, Response } from 'express';
import {
  Conferencia,
  Pacote,
  Remessa,
  ItemPacote,
  Produto,
  Embalagem,
  RegraIcms,
  LogAuditoria,
  Usuario
} from '../models';

export class ConferenciaController {
  // 1. Iniciar uma nova conferência
  static async iniciar(req: Request, res: Response): Promise<void> {
    try {
      const { transportadora } = req.body;
      const usuarioId = req.usuario?.id;

      if (!transportadora) {
        res.status(400).json({ erro: 'O nome da transportadora é obrigatório.' });
        return;
      }

      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      // Verifica se já existe uma conferência em andamento para esta transportadora
      const conferenciaAtiva = await Conferencia.findOne({
        where: {
          transportadora,
          status: 'em_andamento'
        }
      });

      if (conferenciaAtiva) {
        res.status(200).json({
          mensagem: 'Conferência já em andamento recuperada.',
          conferencia: conferenciaAtiva
        });
        return;
      }

      const novaConferencia = await Conferencia.create({
        transportadora,
        usuario_id: usuarioId,
        status: 'em_andamento',
        data_inicio: new Date()
      });

      await LogAuditoria.create({
        usuario_id: usuarioId ?? null,
        acao: 'INICIO_CONFERENCIA',
        detalhes: `Iniciada conferência ID ${novaConferencia.id} para transportadora ${transportadora}.`
      });

      res.status(201).json({
        mensagem: 'Conferência iniciada com sucesso!',
        conferencia: novaConferencia
      });
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao iniciar conferência.' });
    }
  }

  // 2. Buscar conferências ativas (em andamento ou interrompida) com pacotes
  static async listarAtivas(_req: Request, res: Response): Promise<void> {
    try {
      const conferencias = await Conferencia.findAll({
        where: {
          status: ['em_andamento', 'interrompida']
        },
        include: [
          {
            model: Usuario,
            as: 'usuario',
            attributes: ['id', 'nome', 'email', 'perfil']
          },
          {
            model: Remessa,
            as: 'remessas',
            include: [
              {
                model: Pacote,
                as: 'pacotes',
                include: [
                  {
                    model: ItemPacote,
                    as: 'itens',
                    include: [{ model: Produto, as: 'produto' }]
                  },
                  {
                    model: Embalagem,
                    as: 'embalagem'
                  }
                ]
              }
            ]
          }
        ],
        order: [['id', 'DESC']]
      });

      res.status(200).json(conferencias);
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao listar conferências ativas.' });
    }
  }

  // 3. Principal Rota de Bipagem e Validação de Peso (IoT Balança + Leitor Chave)
  static async bipar(req: Request, res: Response): Promise<void> {
    try {
      const { chave_acesso, codigo_caixa, peso_lido } = req.body;
      const usuarioId = req.usuario?.id;

      if (!chave_acesso || peso_lido === undefined || peso_lido === null) {
        res.status(400).json({ erro: 'Chave de acesso e peso lido são obrigatórios.' });
        return;
      }

      const pesoLidoNum = Number(peso_lido);
      if (isNaN(pesoLidoNum) || pesoLidoNum <= 0) {
        res.status(400).json({ erro: 'O peso lido deve ser um número positivo.' });
        return;
      }

      // Busca o pacote pela chave de acesso
      const pacote = await Pacote.findOne({
        where: { chave_acesso: chave_acesso.trim() },
        include: [
          {
            model: ItemPacote,
            as: 'itens',
            include: [{ model: Produto, as: 'produto' }]
          },
          {
            model: Embalagem,
            as: 'embalagem'
          }
        ]
      });

      if (!pacote) {
        res.status(404).json({ erro: 'Pacote não localizado para esta chave de acesso.' });
        return;
      }

      // Validação de estado atual
      if (pacote.status === 'ok' || pacote.status === 'liberado_divergente') {
        res.status(200).json({
          mensagem: 'Pacote já conferido anteriormente com sucesso.',
          status: pacote.status,
          pacote
        });
        return;
      }

      if (pacote.status === 'bloqueado') {
        res.status(403).json({
          erro: 'Pacote bloqueado por reincidência de divergência. Solicite a liberação de um supervisor.',
          status: 'bloqueado',
          tentativas: pacote.tentativas_peso
        });
        return;
      }

      // Obter tara da caixa (se fornecido código de embalagem, busca ou usa do pacote)
      let taraCaixa = 0;
      let embalagemId = pacote.caixa_id;

      if (codigo_caixa) {
        const embalagemEncontrada = await Embalagem.findOne({
          where: { tipo: codigo_caixa }
        });
        if (embalagemEncontrada) {
          taraCaixa = Number(embalagemEncontrada.peso_estimado_g);
          embalagemId = embalagemEncontrada.id;
        }
      } else if (pacote.embalagem) {
        taraCaixa = Number(pacote.embalagem.peso_estimado_g);
      }

      // Cálculo do Peso Esperado = Tara + Σ (Peso Unitário do SKU * Quantidade)
      let pesoProdutos = 0;
      const itens = (pacote as any).itens || [];

      for (const item of itens) {
        const pesoUnitario = item.produto ? Number(item.produto.peso_unitario_g) : 0;
        const qtd = Number(item.quantidade) || 1;
        pesoProdutos += pesoUnitario * qtd;
      }

      // Se o pacote já tiver um peso esperado cadastrado e não houver itens detalhados, usa ele
      let pesoEsperado = taraCaixa + pesoProdutos;
      if (pesoEsperado === 0 && pacote.peso_esperado_g) {
        pesoEsperado = Number(pacote.peso_esperado_g);
      }

      // Tolerância percentual padrão de 2% (conforme especificação da Euroart)
      const toleranciaPercentual = 0.02;
      const limiteMinimo = pesoEsperado * (1 - toleranciaPercentual);
      const limiteMaximo = pesoEsperado * (1 + toleranciaPercentual);

      // Verificação de ICMS / GNRE
      let alertaIcms = false;
      if (pacote.uf) {
        const regra = await RegraIcms.findByPk(pacote.uf.toUpperCase());
        alertaIcms = regra ? regra.exige_guia : false;
      }

      // Validação de Peso
      const pesoValido = pesoLidoNum >= limiteMinimo && pesoLidoNum <= limiteMaximo;

      if (pesoValido) {
        // Aprovado
        pacote.status = 'ok';
        pacote.peso_lido_g = pesoLidoNum;
        pacote.peso_esperado_g = pesoEsperado;
        pacote.caixa_id = embalagemId;
        pacote.data_conferido = new Date();
        await pacote.save();

        await LogAuditoria.create({
          usuario_id: usuarioId ?? null,
          acao: 'CONFERENCIA_OK',
          detalhes: `Pacote NF ${pacote.numero_nf} conferido com sucesso. Lido: ${pesoLidoNum}g, Esperado: ${pesoEsperado}g.`
        });

        res.status(200).json({
          sucesso: true,
          status: 'ok',
          mensagem: 'Pacote conferido e aprovado com sucesso!',
          dados: {
            pacote_id: pacote.id,
            numero_nf: pacote.numero_nf,
            chave_acesso: pacote.chave_acesso,
            peso_lido: pesoLidoNum,
            peso_esperado: pesoEsperado,
            margem_minima: Number(limiteMinimo.toFixed(2)),
            margem_maxima: Number(limiteMaximo.toFixed(2)),
            alerta_guia_icms: alertaIcms,
            uf_destino: pacote.uf
          }
        });
      } else {
        // Divergência de Peso
        pacote.tentativas_peso += 1;
        pacote.peso_lido_g = pesoLidoNum;
        pacote.peso_esperado_g = pesoEsperado;

        if (pacote.tentativas_peso >= 2) {
          // 2ª Falha: Bloqueio de segurança
          pacote.status = 'bloqueado';
          await pacote.save();

          await LogAuditoria.create({
            usuario_id: usuarioId ?? null,
            acao: 'PACOTE_BLOQUEADO',
            detalhes: `Pacote NF ${pacote.numero_nf} bloqueado após 2 divergências. Lido: ${pesoLidoNum}g, Esperado: ${pesoEsperado}g.`
          });

          res.status(403).json({
            sucesso: false,
            erro: 'Pacote bloqueado! 2ª divergência de peso consecutiva detectada. Solicite a liberação de um supervisor.',
            status: 'bloqueado',
            tentativas: pacote.tentativas_peso,
            dados: {
              peso_lido: pesoLidoNum,
              peso_esperado: pesoEsperado,
              margem_minima: Number(limiteMinimo.toFixed(2)),
              margem_maxima: Number(limiteMaximo.toFixed(2))
            }
          });
        } else {
          // 1ª Falha: Permite repesar
          pacote.status = 'divergente_peso';
          await pacote.save();

          await LogAuditoria.create({
            usuario_id: usuarioId ?? null,
            acao: 'DIVERGENCIA_PESO',
            detalhes: `1ª divergência no pacote NF ${pacote.numero_nf}. Lido: ${pesoLidoNum}g, Esperado: ${pesoEsperado}g.`
          });

          res.status(400).json({
            sucesso: false,
            erro: 'Peso divergente fora da tolerância (2%). Retire a caixa e repese.',
            status: 'divergente_peso',
            tentativas: 1,
            dados: {
              peso_lido: pesoLidoNum,
              peso_esperado: pesoEsperado,
              margem_minima: Number(limiteMinimo.toFixed(2)),
              margem_maxima: Number(limiteMaximo.toFixed(2))
            }
          });
        }
      }
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro durante a bipagem do pacote.' });
    }
  }

  // 4. Liberação de Pacote Bloqueado (Alçada exclusiva de Admin)
  static async liberarPacote(req: Request, res: Response): Promise<void> {
    try {
      const pacoteId = Number(req.params.id);
      const { justificativa } = req.body;
      const adminId = req.usuario?.id;

      if (isNaN(pacoteId)) {
        res.status(400).json({ erro: 'ID do pacote inválido.' });
        return;
      }

      if (!justificativa || justificativa.trim().length < 5) {
        res.status(400).json({ erro: 'Justificativa de liberação é obrigatória (mínimo de 5 caracteres).' });
        return;
      }

      const pacote = await Pacote.findByPk(pacoteId);
      if (!pacote) {
        res.status(404).json({ erro: 'Pacote não encontrado.' });
        return;
      }

      if (pacote.status !== 'bloqueado' && pacote.status !== 'divergente_peso') {
        res.status(400).json({ erro: 'Apenas pacotes bloqueados ou com divergência requerem liberação manual.' });
        return;
      }

      pacote.status = 'liberado_divergente';
      pacote.justificativa_liberacao = justificativa;
      pacote.usuario_liberacao_id = adminId ?? null;
      pacote.data_conferido = new Date();
      await pacote.save();

      await LogAuditoria.create({
        usuario_id: adminId ?? null,
        acao: 'LIBERACAO_SUPERVISOR',
        detalhes: `Pacote ID ${pacote.id} (NF: ${pacote.numero_nf}) liberado por admin. Justificativa: "${justificativa}".`
      });

      res.status(200).json({
        sucesso: true,
        mensagem: 'Pacote liberado com sucesso pelo supervisor!',
        pacote
      });
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao liberar pacote.' });
    }
  }

  // 5. Finalizar Conferência
  static async finalizar(req: Request, res: Response): Promise<void> {
    try {
      const conferenciaId = Number(req.params.id);
      const usuarioId = req.usuario?.id;

      if (isNaN(conferenciaId)) {
        res.status(400).json({ erro: 'ID da conferência inválido.' });
        return;
      }

      const conferencia = await Conferencia.findByPk(conferenciaId);
      if (!conferencia) {
        res.status(404).json({ erro: 'Conferência não encontrada.' });
        return;
      }

      conferencia.status = 'finalizada';
      conferencia.data_finalizacao = new Date();
      await conferencia.save();

      await LogAuditoria.create({
        usuario_id: usuarioId ?? null,
        acao: 'FINALIZACAO_CONFERENCIA',
        detalhes: `Conferência ID ${conferenciaId} finalizada.`
      });

      res.status(200).json({
        sucesso: true,
        mensagem: 'Conferência finalizada com sucesso!',
        conferencia
      });
    } catch (error: any) {
      res.status(500).json({ erro: error.message || 'Erro ao finalizar conferência.' });
    }
  }
}
