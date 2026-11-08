import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface LogAuditoriaAttributes {
  id: number;
  usuario_id?: number | null;
  acao: string;
  detalhes?: string | null;
  criado_em?: Date;
}

export interface LogAuditoriaCreationAttributes extends Optional<LogAuditoriaAttributes, 'id' | 'usuario_id' | 'detalhes' | 'criado_em'> {}

export class LogAuditoria extends Model<LogAuditoriaAttributes, LogAuditoriaCreationAttributes> implements LogAuditoriaAttributes {
  public declare id: number;
  public declare usuario_id: number | null;
  public declare acao: string;
  public declare detalhes: string | null;
  public declare criado_em: Date;
}

LogAuditoria.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    acao: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    detalhes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    criado_em: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'logs_auditoria',
    timestamps: false,
  }
);

export default LogAuditoria;
