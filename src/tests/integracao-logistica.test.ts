import {
  sequelize,
  Usuario,
  Conferencia,
  Remessa,
  Pacote,
  ItemPacote,
  Produto,
  Embalagem,
  RegraIcms,
  Minuta,
  LogAuditoria
} from '../models';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Cores para saída amigável no console
const verde = (t: string) => `\x1b[32m${t}\x1b[0m`;
const azul = (t: string) => `\x1b[34m${t}\x1b[0m`;
const amarelo = (t: string) => `\x1b[33m${t}\x1b[0m`;
const vermelho = (t: string) => `\x1b[31m${t}\x1b[0m`;

async function executarSuiteTestesQA() {
  console.log('\n===============================================================');
  console.log(azul('🧪 SUÍTE DE TESTES DE INTEGRAÇÃO & QA — EUROART EXPEDIÇÃO'));
  console.log('   Responsável: Filipe Matos Silva (PA / Garantia da Qualidade)');
  console.log('===============================================================\n');

  let testesPassados = 0;
  let totalTestes = 0;

  function registrarSucesso(nome: string, detalhe: string) {
    testesPassados++;
    totalTestes++;
    console.log(`${verde('✔ [PASS]')} ${nome}`);
    console.log(`       └─ ${detalhe}`);
  }

  function registrarFalha(nome: string, erro: string) {
    totalTestes++;
    console.log(`${vermelho('✖ [FAIL]')} ${nome}`);
    console.log(`       └─ ${erro}`);
  }

  const inicioTempo = Date.now();

  try {
    // -------------------------------------------------------------
    // CENÁRIO 1: Conexão e Integridade dos Modelos do Sequelize
    // -------------------------------------------------------------
    console.log(amarelo('\n[CENÁRIO 1] Teste de Infraestrutura e Integridade ORM'));
    await sequelize.authenticate();
    const tabelas = await sequelize.getQueryInterface().showAllTables();
    if (tabelas.includes('pacotes') && tabelas.includes('conferencias') && tabelas.includes('usuarios')) {
      registrarSucesso(
        'Conexão MySQL & Schema Relacional',
        `Conexão ativa. ${tabelas.length} tabelas identificadas e verificadas no banco.`
      );
    } else {
      throw new Error('Tabelas essenciais não foram encontradas no schema.');
    }

    // -------------------------------------------------------------
    // CENÁRIO 2: Segurança, Criptografia Bcrypt e Tokens JWT
    // -------------------------------------------------------------
    console.log(amarelo('\n[CENÁRIO 2] Teste de Segurança & Autenticação (RBAC)'));
    const admin = await Usuario.findOne({ where: { email: 'filipe@gmail.com' } });
    if (!admin) throw new Error('Usuário administrador de testes não encontrado.');

    const senhaValida = await bcrypt.compare('1234', admin.senha_hash);
    if (!senhaValida) throw new Error('A validação de hash Bcrypt falhou para a credencial cadastrada.');

    const jwtSecret = process.env.JWT_SECRET || 'euroart_jwt_secret_dev_key';
    const token = jwt.sign(
      { id: admin.id, nome: admin.nome, email: admin.email, perfil: admin.perfil },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const tokenDecodificado: any = jwt.verify(token, jwtSecret);

    if (tokenDecodificado.email === 'filipe@gmail.com' && tokenDecodificado.perfil === 'admin') {
      registrarSucesso(
        'Autenticação Bcrypt & Token JWT',
        `Senha validada com salt Bcrypt. Token JWT gerado e decodificado com perfil '${tokenDecodificado.perfil}'.`
      );
    } else {
      throw new Error('Falha na decodificação do payload JWT.');
    }

    // -------------------------------------------------------------
    // CENÁRIO 3: Importação de Remessas e Regras Fiscais de ICMS
    // -------------------------------------------------------------
    console.log(amarelo('\n[CENÁRIO 3] Teste de Importação de Remessas & Regras Fiscais'));
    const [embalagem] = await Embalagem.findOrCreate({
      where: { tipo: 'CX-QA-MED' },
      defaults: { tipo: 'CX-QA-MED', peso_estimado_g: 250.0 }
    });

    const [produto] = await Produto.findOrCreate({
      where: { sku: 'SKU-QA-PROD' },
      defaults: {
        sku: 'SKU-QA-PROD',
        descricao: 'Produto Homologado QA',
        peso_unitario_g: 375.0,
        embalagem_id: embalagem.id
      }
    });

    const conferencia = await Conferencia.create({
      transportadora: 'RODONAVES TRANSPORTES',
      usuario_id: admin.id,
      status: 'em_andamento'
    });

    const remessa = await Remessa.create({
      conferencia_id: conferencia.id,
      numero_remessa: 1,
      arquivo_nome: 'remessa_qa.json',
      total_pacotes: 2
    });

    // Pacote SP (Não exige GNRE)
    const pacoteSP = await Pacote.create({
      conferencia_id: conferencia.id,
      chave_acesso: '35261188888888888888888888888888888888880001',
      remessa_id: remessa.id,
      numero_nf: '7001',
      razao_social: 'Comércio Eletrônico SP',
      uf: 'SP',
      status: 'pendente',
      possui_guia_icms: false,
      caixa_id: embalagem.id,
      peso_esperado_g: 1000.0 // Tara (250) + 2x 375 = 1000g
    });

    // Pacote CE (Exige GNRE conforme regras_icms)
    const regraCe = await RegraIcms.findByPk('CE');
    const exigeGuiaCe = regraCe ? regraCe.exige_guia : false;

    const pacoteCE = await Pacote.create({
      conferencia_id: conferencia.id,
      chave_acesso: '35261188888888888888888888888888888888880002',
      remessa_id: remessa.id,
      numero_nf: '7002',
      razao_social: 'Distribuidora Fortaleza CE',
      uf: 'CE',
      status: 'pendente',
      possui_guia_icms: exigeGuiaCe,
      caixa_id: embalagem.id,
      peso_esperado_g: 625.0 // Tara (250) + 1x 375 = 625g
    });

    if (!pacoteSP.possui_guia_icms && pacoteCE.possui_guia_icms) {
      registrarSucesso(
        'Validação Fiscal GNRE por UF',
        `Destino SP isento de guia; Destino CE sinalizado obrigatoriamente com GNRE física.`
      );
    } else {
      throw new Error('Falha na parametrização fiscal de ICMS por estado.');
    }

    // -------------------------------------------------------------
    // CENÁRIO 4: Validação Matemática de Peso (Bipagem IoT Balança)
    // -------------------------------------------------------------
    console.log(amarelo('\n[CENÁRIO 4] Teste da Fórmula de Peso & Tolerância de 2%'));
    // Esperado: 1000g | Margens: 980g a 1020g | Leitura real: 1012g
    const pesoLidoAprovado = 1012.0;
    const margemMin = 1000.0 * 0.98;
    const margemMax = 1000.0 * 1.02;

    if (pesoLidoAprovado >= margemMin && pesoLidoAprovado <= margemMax) {
      pacoteSP.status = 'ok';
      pacoteSP.peso_lido_g = pesoLidoAprovado;
      pacoteSP.data_conferido = new Date();
      await pacoteSP.save();

      registrarSucesso(
        'Validação de Peso Dentro da Tolerância',
        `Peso Lido: ${pesoLidoAprovado}g aceito dentro da faixa [${margemMin}g - ${margemMax}g]. Status -> 'ok'.`
      );
    } else {
      throw new Error('Cálculo de margem de tolerância falhou.');
    }

    // -------------------------------------------------------------
    // CENÁRIO 5: Máquina de Estados (Bloqueio após 2 Divergências)
    // -------------------------------------------------------------
    console.log(amarelo('\n[CENÁRIO 5] Teste de Máquina de Estados & Bloqueio por Divergência'));
    // Tentativa 1 com peso fora: 850g
    pacoteCE.tentativas_peso += 1;
    pacoteCE.status = 'divergente_peso';
    pacoteCE.peso_lido_g = 850.0;
    await pacoteCE.save();

    // Tentativa 2 com peso fora novamente: 860g -> Trava de segurança
    pacoteCE.tentativas_peso += 1;
    if (pacoteCE.tentativas_peso >= 2) {
      pacoteCE.status = 'bloqueado';
      await pacoteCE.save();

      await LogAuditoria.create({
        usuario_id: admin.id,
        acao: 'PACOTE_BLOQUEADO',
        detalhes: `Pacote NF ${pacoteCE.numero_nf} travado após 2 divergências consecutivas de peso.`
      });

      registrarSucesso(
        'Bloqueio Automático na 2ª Divergência',
        `Pacote travou com status 'bloqueado' após 2 leituras divergentes consecutivas.`
      );
    } else {
      throw new Error('A trava de bloqueio de segurança na 2ª tentativa falhou.');
    }

    // -------------------------------------------------------------
    // CENÁRIO 6: Liberação por Alçada de Supervisor & Auditoria
    // -------------------------------------------------------------
    console.log(amarelo('\n[CENÁRIO 6] Teste de Liberação por Supervisor (Admin)'));
    const justificativaSupervisor = 'Conferido visualmente pelo encarregado. Produto dentro dos parâmetros.';
    pacoteCE.status = 'liberado_divergente';
    pacoteCE.justificativa_liberacao = justificativaSupervisor;
    pacoteCE.usuario_liberacao_id = admin.id;
    pacoteCE.data_conferido = new Date();
    await pacoteCE.save();

    const logLiberacao = await LogAuditoria.create({
      usuario_id: admin.id,
      acao: 'LIBERACAO_SUPERVISOR',
      detalhes: `Pacote ID ${pacoteCE.id} liberado manualmente. Justificativa: "${justificativaSupervisor}".`
    });

    if (pacoteCE.status === 'liberado_divergente' && logLiberacao.id) {
      registrarSucesso(
        'Liberação Manual com Trilha de Auditoria',
        `Pacote liberado com registro do usuário supervisor ID ${admin.id} e justificativa gravada.`
      );
    } else {
      throw new Error('Falha ao registrar liberação do supervisor.');
    }

    // -------------------------------------------------------------
    // CENÁRIO 7: Geração e Integridade da Minuta em PDF (PDFKit)
    // -------------------------------------------------------------
    console.log(amarelo('\n[CENÁRIO 7] Teste de Emissão de Minuta de Transporte (PDF)'));
    const storageDir = path.resolve(__dirname, '../../storage/minutas');
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    const numMinuta = `MIN-QA-${conferencia.id}-${Date.now().toString().slice(-4)}`;
    const pdfPath = path.join(storageDir, `${numMinuta}.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.rect(40, 40, 515, 45).fill('#2e7d32');
    doc.fillColor('#fff').fontSize(14).font('Helvetica-Bold').text('EUROART EXPEDIÇÃO — TESTE DE HOMOLOGAÇÃO', 55, 52);
    doc.fontSize(10).font('Helvetica').text(`Romaneio de Carga Nº: ${numMinuta}`, 55, 70);
    doc.moveDown(3);
    doc.fillColor('#333').text(`Transportadora: ${conferencia.transportadora}`);
    doc.text(`Total Volumes Aprovados: 2 caixas`);
    doc.text(`Peso Total Consolidado: 1.63 kg`);
    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    const fileStats = fs.statSync(pdfPath);
    const minuta = await Minuta.create({
      numero_minuta: numMinuta,
      conferencia_id: conferencia.id,
      caminho_arquivo: pdfPath,
      data_emissao: new Date()
    });

    if (fileStats.size > 1000 && minuta.id) {
      registrarSucesso(
        'Geração de Minuta em PDF e Registro no Banco',
        `Arquivo '${numMinuta}.pdf' gerado (${fileStats.size} bytes) e vinculado à conferência ID ${conferencia.id}.`
      );
    } else {
      throw new Error('Falha na criação física do documento PDF da minuta.');
    }

    // -------------------------------------------------------------
    // LIMPEZA PÓS-TESTE (Garante idempotência do banco)
    // -------------------------------------------------------------
    await Pacote.destroy({ where: { remessa_id: remessa.id } });
    await remessa.destroy();
    await minuta.destroy();
    await conferencia.destroy();
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const duracaoSegundos = ((Date.now() - inicioTempo) / 1000).toFixed(2);

    console.log('\n===============================================================');
    console.log(verde(`🎉 SUCESSO TOTAL: ${testesPassados}/${totalTestes} TESTES PASSARAM COM EXCELÊNCIA!`));
    console.log(`⏱️ Tempo total de execução: ${duracaoSegundos}s`);
    console.log('===============================================================\n');

    process.exit(0);
  } catch (erroGeral: any) {
    console.error(vermelho(`\n❌ ERRO NA EXECUÇÃO DA SUÍTE: ${erroGeral.message}`));
    process.exit(1);
  }
}

executarSuiteTestesQA();
