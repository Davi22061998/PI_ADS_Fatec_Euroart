import sequelize from '../config/database';
import Usuario from './Usuario';
import Embalagem from './Embalagem';
import Produto from './Produto';
import Conferencia from './Conferencia';
import Remessa from './Remessa';
import Pacote from './Pacote';
import ItemPacote from './ItemPacote';
import RegraIcms from './RegraIcms';
import Minuta from './Minuta';
import LogAuditoria from './LogAuditoria';

// Relacionamentos entre os Modelos

// 1. Usuário <-> Conferência
Usuario.hasMany(Conferencia, { foreignKey: 'usuario_id', as: 'conferencias' });
Conferencia.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });

// 2. Conferência <-> Remessas
Conferencia.hasMany(Remessa, { foreignKey: 'conferencia_id', as: 'remessas' });
Remessa.belongsTo(Conferencia, { foreignKey: 'conferencia_id', as: 'conferencia' });

// 3. Remessa <-> Pacotes
Remessa.hasMany(Pacote, { foreignKey: 'remessa_id', as: 'pacotes' });
Pacote.belongsTo(Remessa, { foreignKey: 'remessa_id', as: 'remessa' });

// 4. Pacote <-> Itens do Pacote
Pacote.hasMany(ItemPacote, { foreignKey: 'pacote_id', as: 'itens' });
ItemPacote.belongsTo(Pacote, { foreignKey: 'pacote_id', as: 'pacote' });

// 5. Produto <-> Itens do Pacote
Produto.hasMany(ItemPacote, { foreignKey: 'produto_id', as: 'itens_pacote' });
ItemPacote.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

// 6. Embalagem (Tara) <-> Pacote
Embalagem.hasMany(Pacote, { foreignKey: 'caixa_id', as: 'pacotes' });
Pacote.belongsTo(Embalagem, { foreignKey: 'caixa_id', as: 'embalagem' });

// 7. Auditoria de Liberação de Pacote por Supervisor
Usuario.hasMany(Pacote, { foreignKey: 'usuario_liberacao_id', as: 'pacotes_liberados' });
Pacote.belongsTo(Usuario, { foreignKey: 'usuario_liberacao_id', as: 'supervisor_liberacao' });

// 8. Conferência <-> Minutas em PDF
Conferencia.hasMany(Minuta, { foreignKey: 'conferencia_id', as: 'minutas' });
Minuta.belongsTo(Conferencia, { foreignKey: 'conferencia_id', as: 'conferencia' });

// 9. Usuário <-> Logs de Auditoria
Usuario.hasMany(LogAuditoria, { foreignKey: 'usuario_id', as: 'logs' });
LogAuditoria.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });

export {
  sequelize,
  Usuario,
  Embalagem,
  Produto,
  Conferencia,
  Remessa,
  Pacote,
  ItemPacote,
  RegraIcms,
  Minuta,
  LogAuditoria,
};
