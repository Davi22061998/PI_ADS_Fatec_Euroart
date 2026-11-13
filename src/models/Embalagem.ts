import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface EmbalagemAttributes {
  id: number;
  tipo: string;
  peso_estimado_g: number;
}

export interface EmbalagemCreationAttributes extends Optional<EmbalagemAttributes, 'id'> {}

export class Embalagem extends Model<EmbalagemAttributes, EmbalagemCreationAttributes> implements EmbalagemAttributes {
  public declare id: number;
  public declare tipo: string;
  public declare peso_estimado_g: number;
}

Embalagem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tipo: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    peso_estimado_g: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'embalagens',
    timestamps: false,
  }
);

export default Embalagem;
