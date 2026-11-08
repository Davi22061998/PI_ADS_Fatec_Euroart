import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface ItemPacoteAttributes {
  id: number;
  pacote_id: number;
  produto_id: number;
  quantidade: number;
}

export interface ItemPacoteCreationAttributes extends Optional<ItemPacoteAttributes, 'id'> {}

export class ItemPacote extends Model<ItemPacoteAttributes, ItemPacoteCreationAttributes> implements ItemPacoteAttributes {
  public declare id: number;
  public declare pacote_id: number;
  public declare produto_id: number;
  public declare quantidade: number;
}

ItemPacote.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    pacote_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    produto_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'itens_pacote',
    timestamps: false,
  }
);

export default ItemPacote;
