import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface MinutaAttributes {
  id: number;
  numero_minuta: string;
  conferencia_id: number;
  caminho_arquivo?: string | null;
  data_emissao?: Date;
  data_expiracao?: Date | null;
}

export interface MinutaCreationAttributes extends Optional<MinutaAttributes, 'id' | 'caminho_arquivo' | 'data_emissao' | 'data_expiracao'> {}

export class Minuta extends Model<MinutaAttributes, MinutaCreationAttributes> implements MinutaAttributes {
  public declare id: number;
  public declare numero_minuta: string;
  public declare conferencia_id: number;
  public declare caminho_arquivo: string | null;
  public declare data_emissao: Date;
  public declare data_expiracao: Date | null;
}

Minuta.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    numero_minuta: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    conferencia_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    caminho_arquivo: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    data_emissao: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    data_expiracao: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'minutas',
    timestamps: false,
  }
);

export default Minuta;
