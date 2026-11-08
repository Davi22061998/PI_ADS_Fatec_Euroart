import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface RemessaAttributes {
  id: number;
  conferencia_id: number;
  mkp?: string | null;
  data_importacao?: Date;
}

export interface RemessaCreationAttributes extends Optional<RemessaAttributes, 'id' | 'mkp' | 'data_importacao'> {}

export class Remessa extends Model<RemessaAttributes, RemessaCreationAttributes> implements RemessaAttributes {
  public declare id: number;
  public declare conferencia_id: number;
  public declare mkp: string | null;
  public declare data_importacao: Date;
}

Remessa.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conferencia_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mkp: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    data_importacao: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'remessas',
    timestamps: false,
  }
);

export default Remessa;
