import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface ProdutoAttributes {
  id: number;
  sku: string;
  codigo_xml?: string | null;
  descricao: string;
  peso_unitario_g: number;
  embalagem_id?: number | null;
}

export interface ProdutoCreationAttributes extends Optional<ProdutoAttributes, 'id' | 'codigo_xml' | 'embalagem_id'> {}

export class Produto extends Model<ProdutoAttributes, ProdutoCreationAttributes> implements ProdutoAttributes {
  public declare id: number;
  public declare sku: string;
  public declare codigo_xml: string | null;
  public declare descricao: string;
  public declare peso_unitario_g: number;
  public declare embalagem_id: number | null;
}

Produto.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    codigo_xml: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    descricao: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    peso_unitario_g: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    embalagem_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'produtos',
    timestamps: false,
  }
);

export default Produto;
