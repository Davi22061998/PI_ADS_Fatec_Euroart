import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface ConferenciaAttributes {
  id: number;
  transportadora: string;
  status: 'em_andamento' | 'interrompida' | 'finalizada';
  usuario_id: number;
  data_inicio?: Date;
  data_finalizacao?: Date | null;
}

export interface ConferenciaCreationAttributes extends Optional<ConferenciaAttributes, 'id' | 'status' | 'data_inicio' | 'data_finalizacao'> {}

export class Conferencia extends Model<ConferenciaAttributes, ConferenciaCreationAttributes> implements ConferenciaAttributes {
  public declare id: number;
  public declare transportadora: string;
  public declare status: 'em_andamento' | 'interrompida' | 'finalizada';
  public declare usuario_id: number;
  public declare data_inicio: Date;
  public declare data_finalizacao: Date | null;
}

Conferencia.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    transportadora: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'em_andamento',
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    data_inicio: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    data_finalizacao: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'conferencias',
    timestamps: false,
  }
);

export default Conferencia;
